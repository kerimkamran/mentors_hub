import { VETTING_BOUNDS, VETTING_DEFAULTS } from "./defaults";

export interface VettingSettings {
  reapplyCooloffDays: number;
  minReasonLength: number;
  assessmentReminderLeadDays: number;
  assessmentDueDays: number;
  assessmentRetentionMonths: number;
}

const clamp = (v: number, b: { min: number; max: number }) => Math.min(b.max, Math.max(b.min, Math.trunc(v)));

/**
 * HOOK for the settings centre (S3, FR-VET-013, US-PRG-03). Until settings versions exist this returns the starting
 * defaults for every organisation and programme. S3 replaces the body with a lookup of the programme's (then the
 * organisation's) latest `timings` settings_version; callers do not change. Values are always clamped to the
 * platform bounds, so a bad stored value can never disable a rule.
 */
export async function vettingSettings(organisationId: string, programmeId: string | null = null): Promise<VettingSettings> {
  const merged = { ...baseSettings(), ...(override ? await override(organisationId, programmeId) : {}) };
  return {
    ...merged,
    reapplyCooloffDays: clamp(merged.reapplyCooloffDays, VETTING_BOUNDS.reapplyCooloffDays),
    minReasonLength: clamp(merged.minReasonLength, VETTING_BOUNDS.minReasonLength),
    assessmentReminderLeadDays: clamp(merged.assessmentReminderLeadDays, VETTING_BOUNDS.assessmentReminderLeadDays),
  };
}

/** Test seam (and the S3 integration point for per-organisation values): partial override of the defaults. */
type Override = (organisationId: string, programmeId: string | null) => Promise<Partial<VettingSettings>>;
let override: Override | undefined;
export function setVettingSettingsOverride(fn: Override | undefined): void {
  override = fn;
}

function baseSettings(): VettingSettings {
  return {
    reapplyCooloffDays: VETTING_DEFAULTS.reapplyCooloffDays,
    minReasonLength: VETTING_DEFAULTS.minReasonLength,
    assessmentReminderLeadDays: VETTING_DEFAULTS.assessmentReminderLeadDays,
    assessmentDueDays: VETTING_DEFAULTS.assessmentDueDays,
    assessmentRetentionMonths: VETTING_DEFAULTS.assessmentRetentionMonths,
  };
}

export { clamp as clampSetting };
