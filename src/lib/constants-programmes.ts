/**
 * STARTING DEFAULTS for the admin-managed settings of constants §0 (slice S3). Re-exported from ./constants.
 * These are the values installed when a programme or organisation is created; the settings centre overrides them
 * with bounds-checked, versioned settings. Logic never reads these directly: it goes through the accessors in
 * src/lib/settings.ts. tests/unit/settings-defaults.test.ts asserts this module equals spec/01-prd/constants.md (§0 rule 8).
 */
export const PROGRAMME_TYPES = ["leadership", "sparklab", "open"] as const;
export type ProgrammeType = (typeof PROGRAMME_TYPES)[number];

export const ENROLMENT_MODES = ["invite_only", "rule_based", "nomination"] as const;
export type EnrolmentMode = (typeof ENROLMENT_MODES)[number];

export const REPORT_SCHEDULES = ["monthly_and_final", "per_phase", "none"] as const;
export type ReportSchedule = (typeof REPORT_SCHEDULES)[number];

/** FIXED values the admin-managed settings are validated against (they are not themselves settings). */
export const FIXED = {
  proposalWindowDays: 7, // C-001
  openRequestExpiryDays: 7, // C-002
  acceptedNoSessionDays: 21, // C-005 (health rule I2)
  // C-045 design target: 100 colleagues behind one office address must all be able to sign in. Limits are per email and
  // per browser (never per IP), so each colleague needs enough requests for: the first link, a resend, one retry.
  officeColleagues: 100,
  requestsPerSignIn: 3,
} as const;

/** C-020 Meeting cadence (days). */
export const CADENCE_DAYS: Record<ProgrammeType, number> = { leadership: 14, sparklab: 14, open: 30 };
/** C-021 Mentor capacity default (mentees; SparkLab counts teams). */
export const CAPACITY_DEFAULT: Record<ProgrammeType, number> = { leadership: 2, sparklab: 2, open: 3 };
/**
 * Starting default for the capacity MAXIMUM. The constants table gives no value (§0 only bounds it: >= default, <= 20),
 * so the starting maximum is a decision recorded in the build report: 5 for every programme type.
 */
export const CAPACITY_MAX_DEFAULT = 5;

export const WEIGHT_KEYS = ["goal", "expertise", "availability", "career", "language", "interests", "other"] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];
/** C-070 (Open), C-071 (Leadership), C-072 (SparkLab); each column totals 100. */
export const WEIGHTS: Record<ProgrammeType, Record<WeightKey, number>> = {
  open: { goal: 30, expertise: 25, availability: 15, career: 10, language: 10, interests: 5, other: 5 },
  leadership: { goal: 25, expertise: 25, availability: 5, career: 15, language: 10, interests: 0, other: 20 },
  sparklab: { goal: 35, expertise: 30, availability: 15, career: 10, language: 10, interests: 0, other: 0 },
};

/** C-080…C-082: never overridable, always on. */
export const LOCKED_EXCLUSIONS = ["samePerson", "blocked", "notApproved"] as const;
/** C-083…C-092: PM-switchable. Defaults per programme type. */
export const SWITCHABLE_EXCLUSIONS = [
  "eligibility", // C-083
  "incompatibleHistory", // C-084
  "declinedRecently", // C-085
  "reportingLine", // C-086
  "reportingPeer", // C-087
  "mentorJunior", // C-088
  "noLanguage", // C-089
  "noAvailability", // C-090
  "capacityFull", // C-091
  "alreadyMatched", // C-092
] as const;
export type SwitchableExclusion = (typeof SWITCHABLE_EXCLUSIONS)[number];
export const EXCLUSION_DEFAULTS: Record<ProgrammeType, Record<SwitchableExclusion, boolean>> = {
  open: { eligibility: true, incompatibleHistory: true, declinedRecently: true, reportingLine: true, reportingPeer: false, mentorJunior: false, noLanguage: true, noAvailability: true, capacityFull: true, alreadyMatched: true },
  leadership: { eligibility: true, incompatibleHistory: true, declinedRecently: true, reportingLine: true, reportingPeer: true, mentorJunior: true, noLanguage: true, noAvailability: true, capacityFull: true, alreadyMatched: true },
  sparklab: { eligibility: true, incompatibleHistory: true, declinedRecently: true, reportingLine: true, reportingPeer: false, mentorJunior: false, noLanguage: true, noAvailability: true, capacityFull: true, alreadyMatched: true },
};

/** C-050…C-060, C-150: matching factors, sub-scores, thresholds, horizon (identical for every type). */
export const MATCHING_FACTOR_DEFAULTS = {
  depthFactors: { working: 0.5, advanced: 0.75, expert: 1 }, // C-050
  primaryGoalMultiplier: 2, // C-051
  parentChildCredit: 0.5, // C-052
  availabilitySaturationDays: 3, // C-053
  careerBands: { ahead: 1, peer: 0.6, far: 0.4, mentorJunior: 0.3 }, // C-054
  // C-055: gap = mentor bucket - mentee bucket. ahead 1..2, peer 0, far 3+, mentor-junior below peer.
  careerGaps: { peerMin: 0, peerMax: 0, aheadMin: 1, aheadMax: 2, farMin: 3 },
  languageScores: { fluent: 1, working: 0.7 }, // C-056
  neutralScore: 0.5, // C-057
  reasonThreshold: 0.6, // C-059
  commonReasonCutoff: 0.9, // C-060
  availabilityHorizonWeeks: 4, // C-150
} as const;

/** C-003, C-151…C-157. */
export const TIMING_DEFAULTS = {
  openRequestReminderDays: 4, // C-003 days after the request
  assessmentReminderLeadDays: 3, // C-153 days before due
  proposalReminderLeadDays: 2, // C-154 days before the deadline
  reportReminderLeadDays: 3, // C-157 days before due
  wrapUpNudgeHours: 2, // C-155 hours after the session ends
  noGoalNudgeDays: 7, // C-156 days after acceptance
  reapplyCoolOffDays: 180, // C-151
  minReasonLength: 10, // C-152
} as const;

/** C-158, C-159. */
export const SESSION_TIMING_DEFAULTS = { noShowGraceMinutes: 15, aboutToStartMinutes: 15 } as const;

/** C-160, C-164, C-165, C-166, C-167. */
export const ADMIN_OPS_DEFAULTS = {
  approvalLifetimeDays: 7,
  announcementMaxLength: 600,
  bounceThresholdPercent: 5,
  bounceMinSends: 20,
  responseTargetDays: 30,
  dueSoonLeadDays: 7,
} as const;

/** C-114 brand tokens. The three named in C-114 are the spec values; the other three are derived neutral defaults. */
export const BRAND_DEFAULTS = {
  primary: "#0f3c76",
  accent: "#356d1b",
  canvas: "#e7eef8",
  surface: "#ffffff",
  ink: "#111827",
  onPrimary: "#ffffff",
} as const;

export const REPORT_SCHEDULE_BY_TYPE: Record<ProgrammeType, ReportSchedule> = {
  leadership: "monthly_and_final", // FR-RPT-003: mandatory monthly + final
  sparklab: "per_phase", // mandatory per phase
  open: "none", // optional, off by default
};

/** Platform-enforced bounds (constants §0). Single place; the registry and the tests both read these. */
export const BOUNDS = {
  cadenceDays: { min: 1, max: 90 },
  capacityDefault: { min: 1, max: 10 },
  capacityMax: { min: 1, max: 20 },
  depthFactor: { min: 0, max: 1 }, // (0, 1]
  primaryGoalMultiplier: { min: 1, max: 5 },
  unit: { min: 0, max: 1 }, // [0, 1]
  availabilitySaturationDays: { min: 1, max: 7 },
  gap: { min: -20, max: 20 },
  horizonWeeks: { min: 1, max: 12 },
  coolOffDays: { min: 0, max: 730 },
  minReasonLength: { min: 0, max: 200 },
  reminderLeadDays: { min: 1, max: 30 },
  wrapUpNudgeHours: { min: 1, max: 72 },
  noShowGraceMinutes: { min: 5, max: 60 },
  aboutToStartMinutes: { min: 5, max: 60 },
  linkLifetimeMinutes: { min: 5, max: 30 },
  codeAttempts: { min: 3, max: 10 },
  sessionIdleMinutes: { min: 15, max: 24 * 60 },
  sessionAbsoluteDays: { min: 1, max: 90 },
  rateWindowMinutes: { min: 5, max: 60 },
  rateRequestsPerEmail: { min: FIXED.requestsPerSignIn, max: 20 },
  rateRequestsPerBrowser: { min: 10, max: 200 },
  approvalLifetimeDays: { min: 1, max: 30 },
  announcementMaxLength: { min: 100, max: 2000 },
  bounceThresholdPercent: { min: 1, max: 50 },
  bounceMinSends: { min: 10, max: 1000 },
  responseTargetDays: { min: 1, max: 90 },
  dueSoonLeadDays: { min: 1, max: 30 },
} as const;

/** Logo limits (AC-TEN-05.5). */
export const LOGO_MAX_BYTES = 512 * 1024;

/** Contrast thresholds (WCAG 2.2 AA): normal text 4.5:1. */
export const CONTRAST_MIN = 4.5;
