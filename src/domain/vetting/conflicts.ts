/** Conflict-of-interest rules for assessors (FR-VET-007): self, direct manager, direct report. */
import type { Tx } from "@/lib/db";

export type ConflictReason = "self" | "assessor_is_manager" | "assessor_is_report";

/** Reporting edge lookup: the direct manager's membership id of a person, or null if unknown or none. */
export type ManagerLookup = (membershipId: string) => string | null;

/** Pure. `managerOf(x)` is x's direct manager. */
export function conflictOfInterest(applicantId: string, assessorId: string, managerOf: ManagerLookup): ConflictReason | null {
  if (applicantId === assessorId) return "self";
  if (managerOf(applicantId) === assessorId) return "assessor_is_manager"; // the assessor manages the applicant
  if (managerOf(assessorId) === applicantId) return "assessor_is_report"; // the assessor reports to the applicant
  return null;
}

/**
 * Loads the manager edges for a set of people from hr_record.manager_membership_id (S2 people import). Until S2's
 * table exists, or if it has no such column, there are no known edges (the self rule still applies). Guarded with
 * to_regclass so this slice's migrations and tests do not depend on S2.
 */
export async function loadManagerEdges(tx: Tx, membershipIds: string[]): Promise<ManagerLookup> {
  const edges = new Map<string, string | null>();
  const t = await tx.query<{ ok: boolean }>(
    `SELECT to_regclass('hr_record') IS NOT NULL AND EXISTS (
       SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_record' AND column_name = 'manager_membership_id') AS ok`,
  );
  if (t.rows[0]?.ok) {
    const r = await tx.query<{ membership_id: string; manager_membership_id: string | null }>(
      "SELECT membership_id, manager_membership_id FROM hr_record WHERE membership_id = ANY($1::uuid[])",
      [membershipIds],
    );
    for (const row of r.rows) edges.set(row.membership_id, row.manager_membership_id);
  }
  return (id) => edges.get(id) ?? null;
}
