import type { Tx } from "@/lib/db";

/**
 * Is the person eligible to apply to this programme (AC-VET-01.4)? ONE function so the eligibility rules of the programme
 * slice (S3: tenure, grade bucket, department) can be added here without touching callers.
 * Today: an active member of the organisation, and the programme exists in the organisation and is accepting
 * applications (status `active`). A person deactivated after sign-in, or a programme in another organisation, is ineligible.
 */
export async function isEligibleForProgramme(tx: Tx, membershipId: string, programmeId: string): Promise<boolean> {
  const r = await tx.query(
    `SELECT 1 FROM membership m, programme p
     WHERE m.id = $1 AND m.status = 'active' AND p.id = $2 AND p.status = 'active'`,
    [membershipId, programmeId],
  );
  return (r.rowCount ?? 0) > 0;
}

/** A PM may nominate any active member into a programme that is not closed. */
export async function canBeNominated(tx: Tx, membershipId: string, programmeId: string): Promise<boolean> {
  const r = await tx.query(
    `SELECT 1 FROM membership m, programme p
     WHERE m.id = $1 AND m.status = 'active' AND p.id = $2 AND p.status IN ('draft', 'active')`,
    [membershipId, programmeId],
  );
  return (r.rowCount ?? 0) > 0;
}
