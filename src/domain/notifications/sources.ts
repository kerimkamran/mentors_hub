import type { Tx } from "@/lib/db";

/**
 * INTEGRATION HOOKS. Data that belongs to tables other slices own is read through these functions only, so a template
 * never hard-codes another slice's schema. Each returns the "nothing known" value until its owner wires it; the
 * owning slice replaces ONLY the body of its function (signature stays).
 */

/** Sponsors' names for a programme (FR-PRG-007, N-011, N-075). Owner: S3 programmes (programme_sponsor). */
export async function programmeSponsorNames(_tx: Tx, _programmeId: string): Promise<string[]> {
  return [];
}

/** Counts of an import run (N-010). Owner: S2 people import. Null while the import run table is unknown. */
export async function importRunCounts(
  _tx: Tx,
  _importRunId: string,
  _recipientMembershipId: string,
): Promise<{ created: number; updated: number; rejected: number } | null> {
  return null;
}
