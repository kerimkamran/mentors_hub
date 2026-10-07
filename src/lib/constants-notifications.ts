/**
 * Starting defaults for the notification, email-delivery and admin-operations settings (constants §0, rows
 * "Reminder and nudge timings" and "Admin operations"). Kept next to, not inside, src/lib/constants.ts so parallel
 * slices never collide in that file; the integrator may fold this block into DEFAULTS. Code reads these ONLY through
 * src/domain/notifications/settings.ts (ARCHITECTURE rule 9).
 */
export const NOTIFICATION_DEFAULTS = {
  // Reminder and nudge timings, programme scope (FR-MSG-009). Minutes, so every one is a plain number.
  openRequestReminderAfterMinutes: 4 * 24 * 60, // C-003: 4 days after the request (3 days left of C-002)
  assessmentReminderLeadMinutes: 3 * 24 * 60, // C-153: 3 days before due
  proposalReminderLeadMinutes: 2 * 24 * 60, // C-154: 2 days before the deadline
  wrapUpNudgeDelayMinutes: 2 * 60, // C-155: 2 hours after the session ends
  noGoalNudgeDelayMinutes: 7 * 24 * 60, // C-156: 7 days after acceptance
  reportReminderLeadMinutes: 3 * 24 * 60, // C-157: 3 days before due
  // Admin operations, organisation scope.
  announcementMaxChars: 600, // C-164 (an end date is always required)
  bounceAlertPercent: 5, // C-165: >= 5 % bounced ...
  bounceAlertMinSends: 20, // ... of >= 20 sends ...
  bounceAlertWindowHours: 24, // ... within 24 hours
  // Platform-wide operational retention (not admin settings).
  deliveryLogRetentionDays: 30, // C-161
  jobHistoryRetentionDays: 30, // C-162
  // Engine choices of this slice.
  dedupeWindowMinutes: 10, // same recipient + template + subject inside this window is one notification
  mailMaxAttempts: 5, // graphile-worker back-off attempts for one delivery
} as const;

/** Bounds enforced when the settings centre saves these values (constants §0). */
export const NOTIFICATION_BOUNDS = {
  announcementMaxChars: { min: 100, max: 2000 },
  bounceAlertPercent: { min: 1, max: 50 },
  bounceAlertMinSends: { min: 10, max: 10_000 },
} as const;

/** Reminder/nudge keys and the event they relate to; `before` means the lead must fall before the event (FR-MSG-009). */
export const REMINDER_KINDS = {
  openRequestReminder: { constant: "C-003", direction: "after" },
  assessmentReminder: { constant: "C-153", direction: "before" },
  proposalReminder: { constant: "C-154", direction: "before" },
  wrapUpNudge: { constant: "C-155", direction: "after" },
  noGoalNudge: { constant: "C-156", direction: "after" },
  reportReminder: { constant: "C-157", direction: "before" },
} as const;
