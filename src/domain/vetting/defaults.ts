/**
 * Starting defaults for the vetting numbers that the spec marks as admin-managed (constants §0).
 * Kept in the slice's own file so parallel slices do not collide on src/lib/constants.ts; the settings
 * centre (S3) swaps the source inside ./settings.ts, callers never read these directly (ARCHITECTURE rule 9).
 */
export const VETTING_DEFAULTS = {
  reapplyCooloffDays: 180, // C-151
  minReasonLength: 10, // C-152
  assessmentReminderLeadDays: 3, // C-153 (before the due date)
  assessmentDueDays: 14, // chosen by this slice: default due date offered when an assessor is assigned (spec silent)
  defaultAssessors: 1, // C-026 default
  assessmentRetentionMonths: 24, // C-102 / FR-VET-010
} as const;

/** Platform-enforced bounds (constants §0): cool-off 0-730 days; reason length 0-200 characters. */
export const VETTING_BOUNDS = {
  reapplyCooloffDays: { min: 0, max: 730 },
  minReasonLength: { min: 0, max: 200 },
  assessmentReminderLeadDays: { min: 0, max: 30 },
} as const;

/** Fixed by FR-VET-005: at most two assessors per application (C-026 maximum). */
export const MAX_ASSESSORS = 2;
