import type { Tx } from "@/lib/db";
import { getMentorStatus, type MentorStatus } from "./mentor-status";

/**
 * Seams to slices that are not built yet. Production code uses `defaultProfileDeps`; tests inject fakes.
 *  - getMentorStatus: S5 (approved mentor).
 *  - requestPartners: S6/S11 (people I have sent or received a request or proposal with). Relationship partners are read here directly.
 */
export interface ProfileDeps {
  getMentorStatus: (tx: Tx, membershipId: string, programmeId?: string) => Promise<MentorStatus>;
  requestPartners: (tx: Tx, membershipId: string) => Promise<Set<string>>;
}

export const defaultProfileDeps: ProfileDeps = {
  getMentorStatus,
  requestPartners: async () => new Set<string>(),
};
