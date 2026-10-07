import type { Tx } from "@/lib/db";
import type { Recipient } from "./types";

/**
 * Small "may this recipient see it" helpers shared by templates (R6). They read the database, never the request.
 * Slice-specific templates may add their own; anything stricter than these must still return false when unsure.
 */

/** Organisation admins, and PMs whose grant covers the programme (programme scope, or a cohort of it). */
export async function isProgrammeStaff(tx: Tx, r: Recipient, programmeId: string): Promise<boolean> {
  if (r.roles.some((g) => g.role === "org_admin" && g.scopeType === "org")) return true;
  if (r.roles.some((g) => g.role === "pm" && g.scopeType === "org")) return true;
  if (r.roles.some((g) => g.role === "pm" && g.scopeType === "programme" && g.scopeId === programmeId)) return true;
  const cohortIds = r.roles.filter((g) => g.role === "pm" && g.scopeType === "cohort" && g.scopeId).map((g) => g.scopeId!);
  if (cohortIds.length === 0) return false;
  const c = await tx.query("SELECT 1 FROM cohort WHERE programme_id = $1 AND id = ANY($2::uuid[])", [programmeId, cohortIds]);
  return (c.rowCount ?? 0) > 0;
}

/** The recipient takes part in the programme (invited or enrolled, not withdrawn). */
export async function isProgrammeParticipant(tx: Tx, membershipId: string, programmeId: string): Promise<boolean> {
  const p = await tx.query(
    `SELECT 1 FROM participation p JOIN cohort c ON c.id = p.cohort_id AND c.organisation_id = p.organisation_id
      WHERE p.membership_id = $1 AND c.programme_id = $2 AND p.status <> 'withdrawn'`,
    [membershipId, programmeId],
  );
  return (p.rowCount ?? 0) > 0;
}

export async function displayName(tx: Tx, membershipId: string | null): Promise<string | null> {
  if (!membershipId) return null;
  const r = await tx.query<{ display_name: string }>("SELECT display_name FROM person_profile WHERE membership_id = $1", [membershipId]);
  return r.rows[0]?.display_name ?? null;
}
