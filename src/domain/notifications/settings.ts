import { NOTIFICATION_BOUNDS, NOTIFICATION_DEFAULTS as D } from "@/lib/constants-notifications";

/**
 * HOOKS for the settings centre (FR-PRG-014). Each accessor is one function so the settings registry can swap the
 * source (latest settings_version of the programme/organisation) without touching a caller. Until then the starting
 * defaults of constants §0 are returned.
 */
export interface ReminderTimings {
  openRequestReminderAfterMinutes: number; // C-003
  assessmentReminderLeadMinutes: number; // C-153
  proposalReminderLeadMinutes: number; // C-154
  wrapUpNudgeDelayMinutes: number; // C-155
  noGoalNudgeDelayMinutes: number; // C-156
  reportReminderLeadMinutes: number; // C-157
}

export async function reminderTimings(_organisationId: string, _programmeId?: string | null): Promise<ReminderTimings> {
  return {
    openRequestReminderAfterMinutes: D.openRequestReminderAfterMinutes,
    assessmentReminderLeadMinutes: D.assessmentReminderLeadMinutes,
    proposalReminderLeadMinutes: D.proposalReminderLeadMinutes,
    wrapUpNudgeDelayMinutes: D.wrapUpNudgeDelayMinutes,
    noGoalNudgeDelayMinutes: D.noGoalNudgeDelayMinutes,
    reportReminderLeadMinutes: D.reportReminderLeadMinutes,
  };
}

export interface OpsSettings {
  announcementMaxChars: number; // C-164
  bounceAlertPercent: number; // C-165
  bounceAlertMinSends: number; // C-165
  bounceAlertWindowHours: number; // C-165
}

export async function opsSettings(_organisationId: string): Promise<OpsSettings> {
  return {
    announcementMaxChars: clamp(D.announcementMaxChars, NOTIFICATION_BOUNDS.announcementMaxChars),
    bounceAlertPercent: clamp(D.bounceAlertPercent, NOTIFICATION_BOUNDS.bounceAlertPercent),
    bounceAlertMinSends: clamp(D.bounceAlertMinSends, NOTIFICATION_BOUNDS.bounceAlertMinSends),
    bounceAlertWindowHours: D.bounceAlertWindowHours,
  };
}

/** Platform-wide retention (C-161, C-162): not admin-managed, so it does not depend on an organisation. */
export function retentionDays(): { deliveryLog: number; jobHistory: number } {
  return { deliveryLog: D.deliveryLogRetentionDays, jobHistory: D.jobHistoryRetentionDays };
}

const clamp = (v: number, b: { min: number; max: number }) => Math.min(b.max, Math.max(b.min, v));
