import type { ProgrammeType, WeightKey, SwitchableExclusion } from "../../lib/constants-programmes";
import type { BrandTokens } from "./contrast";

export const GROUP_IDS = ["cadence_capacity", "matching", "timings", "flags", "security", "session_timing", "admin_ops", "brand", "localisation"] as const;
export type GroupId = (typeof GROUP_IDS)[number];
export type ScopeKind = "organisation" | "programme";
export type SettingsScope = { type: "organisation" } | { type: "programme"; id: string };

export const PROGRAMME_GROUPS: readonly GroupId[] = ["cadence_capacity", "matching", "timings", "flags"];
export const ORG_GROUPS: readonly GroupId[] = ["security", "session_timing", "admin_ops", "flags", "brand", "localisation"];
export const groupsOf = (kind: ScopeKind): readonly GroupId[] => (kind === "programme" ? PROGRAMME_GROUPS : ORG_GROUPS);
export const scopeKind = (s: SettingsScope): ScopeKind => s.type;
/** Groups whose save needs an authenticator code (matrix §4.3: sign-in/security and session settings). */
export const STEP_UP_GROUPS: readonly GroupId[] = ["security", "session_timing"];

export interface CadenceCapacityValues { cadenceDays: number; capacityDefault: number; capacityMax: number }
export interface MatchingValues {
  depthFactors: { working: number; advanced: number; expert: number };
  primaryGoalMultiplier: number;
  parentChildCredit: number;
  availabilitySaturationDays: number;
  careerBands: { ahead: number; peer: number; far: number; mentorJunior: number };
  careerGaps: { peerMin: number; peerMax: number; aheadMin: number; aheadMax: number; farMin: number };
  languageScores: { fluent: number; working: number };
  neutralScore: number;
  reasonThreshold: number;
  commonReasonCutoff: number;
  weights: Record<WeightKey, number>;
  exclusions: Record<SwitchableExclusion, boolean> & { samePerson: boolean; blocked: boolean; notApproved: boolean };
  availabilityHorizonWeeks: number;
}
export interface TimingsValues {
  openRequestReminderDays: number;
  assessmentReminderLeadDays: number;
  proposalReminderLeadDays: number;
  reportReminderLeadDays: number;
  wrapUpNudgeHours: number;
  noGoalNudgeDays: number;
  reapplyCoolOffDays: number;
  minReasonLength: number;
}
export interface OrgFlagsValues {
  aiEnabled: boolean; smartGoalAssistant: boolean; agendaAssistant: boolean; aiTranslation: boolean; attachments: boolean; openMentoring: boolean;
}
export interface ProgrammeFlagsValues { aiEnabled: boolean; attachments: boolean; openReports: boolean }
export type FlagsValues = OrgFlagsValues | ProgrammeFlagsValues;
export interface SecurityValues {
  linkLifetimeMinutes: number; codeAttempts: number; sessionIdleMinutes: number; sessionAbsoluteDays: number;
  rateWindowMinutes: number; rateRequestsPerEmail: number; rateRequestsPerBrowser: number;
}
export interface SessionTimingValues { noShowGraceMinutes: number; aboutToStartMinutes: number }
export interface AdminOpsValues {
  approvalLifetimeDays: number; announcementMaxLength: number; bounceThresholdPercent: number; bounceMinSends: number; responseTargetDays: number; dueSoonLeadDays: number;
}
export interface BrandValues extends BrandTokens { logoId: string | null }
export interface LocalisationValues { defaultLocale: "en" | "az" | "ru"; timeZone: string }

export interface GroupValues {
  cadence_capacity: CadenceCapacityValues;
  matching: MatchingValues;
  timings: TimingsValues;
  flags: FlagsValues;
  security: SecurityValues;
  session_timing: SessionTimingValues;
  admin_ops: AdminOpsValues;
  brand: BrandValues;
  localisation: LocalisationValues;
}

export type Values = Record<string, unknown>;

/** A validation problem; `path` is the dotted field path inside the group. Messages are translated by the UI (no free text is stored). */
export interface Problem {
  group: GroupId;
  path: string;
  code: string;
  params?: Record<string, string | number>;
}

export type { ProgrammeType };

/** Thrown when a save, restore or import fails validation: nothing was written. */
export class SettingsRejected extends Error {
  constructor(readonly problems: Problem[]) {
    super(`settings rejected: ${problems.map((p) => `${p.group}.${p.path}:${p.code}`).join(", ")}`);
  }
}
/** Thrown when an active programme's change was not confirmed after the impact summary (rule 7). */
export class ConfirmationRequired extends Error {
  constructor(readonly impact: ImpactLine[]) {
    super("confirmation required");
  }
}
/** The authenticator code (step-up) was missing or wrong. */
export class StepUpFailed extends Error {
  constructor() {
    super("step-up code missing or invalid");
  }
}

export interface ImpactLine { key: string; params?: Record<string, string | number> }
