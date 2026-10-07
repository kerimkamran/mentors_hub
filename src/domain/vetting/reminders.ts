/**
 * Thin scheduling seam for vetting reminders (N-023 assessment reminder, C-153). The notifications slice (S3) implements
 * a scheduler and registers it with `setReminderScheduler`; until then the default does nothing and records nothing.
 * Payloads carry ids and codes only (INV-3): never names, scores or free text.
 */
export type ReminderKind = "assessment_due";

export interface ReminderRequest {
  organisationId: string;
  kind: ReminderKind;
  recipientMembershipId: string;
  subjectType: "assessment";
  subjectId: string;
  remindAt: Date;
}
export interface CancelReminderRequest {
  organisationId: string;
  kind: ReminderKind;
  subjectType: "assessment";
  subjectId: string;
}
export interface ReminderScheduler {
  schedule(r: ReminderRequest): Promise<void>;
  cancel(r: CancelReminderRequest): Promise<void>;
}

const noop: ReminderScheduler = { schedule: async () => undefined, cancel: async () => undefined };
let current: ReminderScheduler = noop;

/** Called once by the notifications slice at start-up. Pass undefined to restore the no-op (tests). */
export function setReminderScheduler(s: ReminderScheduler | undefined): void {
  current = s ?? noop;
}
export const scheduleReminder = (r: ReminderRequest): Promise<void> => current.schedule(r);
export const cancelReminder = (r: CancelReminderRequest): Promise<void> => current.cancel(r);
