import type { Tx } from "@/lib/db";

/**
 * HOOKS for the settings registry (S3). Until settings versions exist these return the starting
 * defaults from constants §0; S3 swaps the bodies, callers do not change (ARCHITECTURE rule 9).
 */
export type ProgrammeType = "leadership" | "sparklab" | "open";

/** C-021 starting defaults (leadership 2 mentees, open 3 mentees, sparklab 2 teams). */
const CAPACITY_DEFAULT: Record<ProgrammeType, number> = { leadership: 2, open: 3, sparklab: 2 };
/** Programme maximum a mentor may set (admin-managed, ≥ default and ≤ 20). Starting default: 10. */
const CAPACITY_MAXIMUM = 10;

export interface CapacityLimits {
  default: number;
  maximum: number;
}

export async function capacityLimits(_tx: Tx, programmeType: ProgrammeType): Promise<CapacityLimits> {
  return { default: CAPACITY_DEFAULT[programmeType], maximum: CAPACITY_MAXIMUM };
}

/** C-057: neutral score for a missing MENTEE answer (admin-managed; default 0.50). */
export async function neutralScore(_tx: Tx): Promise<number> {
  return 0.5;
}

/** C-058 (FIXED): score for a missing MENTOR answer. */
export const MISSING_MENTOR_SCORE = 0;

/** C-150: availability horizon for matching, in weeks (admin-managed; default 4). */
export async function availabilityHorizonWeeks(_tx: Tx): Promise<number> {
  return 4;
}

/** C-053: availability saturation, days per week giving a full score (admin-managed; default 3). */
export async function availabilitySaturationDays(_tx: Tx): Promise<number> {
  return 3;
}
