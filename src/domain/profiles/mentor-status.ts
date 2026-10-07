import type { Tx } from "@/lib/db";

/**
 * Interface to mentor vetting (slice S5). S5 replaces the BODY of getMentorStatus with a lookup of the mentor
 * application/decision; callers (this slice and matching) do not change. Until then the safe default applies:
 * nobody is treated as an approved mentor, so nobody is recommendable or discoverable through this slice.
 */
export type MentorApproval = "approved" | "not_approved" | "pending" | "suspended" | "unknown";

export interface MentorStatus {
  approved: boolean;
  state: MentorApproval;
}

/** `programmeId` omitted = "approved in at least one programme". */
export async function getMentorStatus(_tx: Tx, _membershipId: string, _programmeId?: string): Promise<MentorStatus> {
  return { approved: false, state: "unknown" };
}
