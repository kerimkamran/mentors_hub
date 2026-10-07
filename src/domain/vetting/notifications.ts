/**
 * Notification seam for the vetting events of the catalogue (N-020, N-021, N-022, N-024, N-025). The notifications slice
 * (S3) registers a sink with `setVettingNotifier`; the default does nothing. Events carry ids and codes only: an email or
 * in-app item built from them can never contain scores, reasons or free text (catalogue R2, INV-3).
 */
import type { Tx } from "@/lib/db";

export type VettingNotificationCode = "N-020" | "N-021" | "N-022" | "N-024" | "N-025";

export interface VettingNotification {
  code: VettingNotificationCode;
  organisationId: string;
  recipientMembershipId: string;
  applicationId: string;
  programmeId: string;
  /** N-025 only: the outcome word (approved / rejected). Never a score. */
  outcome?: "approved" | "rejected";
}
export type VettingNotifier = (tx: Tx, n: VettingNotification) => Promise<void>;

let sink: VettingNotifier = async () => undefined;
export function setVettingNotifier(n: VettingNotifier | undefined): void {
  sink = n ?? (async () => undefined);
}
export const notifyVetting: VettingNotifier = (tx, n) => sink(tx, n);

/** Membership ids of the programme managers whose scope covers the programme (org-wide or this programme). */
export async function programmeManagers(tx: Tx, programmeId: string): Promise<string[]> {
  const r = await tx.query<{ membership_id: string }>(
    `SELECT DISTINCT membership_id FROM role_grant
     WHERE role = 'pm' AND (scope_type = 'org' OR (scope_type = 'programme' AND scope_id = $1))`,
    [programmeId],
  );
  return r.rows.map((x) => x.membership_id);
}
