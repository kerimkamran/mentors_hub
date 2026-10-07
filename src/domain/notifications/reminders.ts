import type { Tx } from "@/lib/db";
import { REMINDER_KINDS } from "@/lib/constants-notifications";
import { cancelJob, enqueueInTx } from "./queue";
import { reminderTimings, type ReminderTimings } from "./settings";

/**
 * Reminder scheduling (FR-MSG-009). A reminder is a delayed `notify.fire` job with a job key, so it can be replaced
 * (the event moved) or cancelled (the event was cancelled / answered) by key. When the job runs it notifies through
 * notify(), which re-checks that the recipient may still see the object, so a stale reminder simply drops out.
 */
export type ReminderKind = keyof typeof REMINDER_KINDS;

const MINUTES: Record<ReminderKind, keyof ReminderTimings> = {
  openRequestReminder: "openRequestReminderAfterMinutes",
  assessmentReminder: "assessmentReminderLeadMinutes",
  proposalReminder: "proposalReminderLeadMinutes",
  wrapUpNudge: "wrapUpNudgeDelayMinutes",
  noGoalNudge: "noGoalNudgeDelayMinutes",
  reportReminder: "reportReminderLeadMinutes",
};

/**
 * When to fire, from the event time and the configured lead/delay.
 *  - "before" kinds (C-153, C-154, C-157): eventAt - lead. If that moment has passed but the event has not, fire now;
 *    if the event itself has passed, there is nothing to remind (null).
 *  - "after" kinds (C-003, C-155, C-156): eventAt + delay (never in the past: fire now if it is).
 */
export function reminderRunAt(kind: ReminderKind, eventAt: Date, minutes: number, now: Date = new Date()): Date | null {
  if (!Number.isFinite(minutes) || minutes < 0) throw new Error("reminder timing must be a non-negative number of minutes");
  if (REMINDER_KINDS[kind].direction === "before") {
    if (eventAt.getTime() <= now.getTime()) return null;
    const at = new Date(eventAt.getTime() - minutes * 60_000);
    return at.getTime() < now.getTime() ? now : at;
  }
  const at = new Date(eventAt.getTime() + minutes * 60_000);
  return at.getTime() < now.getTime() ? now : at;
}

export const reminderKey = (template: string, subjectId: string, recipientId: string) => `rem:${template}:${subjectId}:${recipientId}`;

export interface ScheduleReminderInput {
  organisationId: string;
  kind: ReminderKind;
  template: string;
  recipientId: string;
  subjectId: string;
  /** The event the timing relates to: due date, deadline, session end, acceptance time, request time. */
  eventAt: Date;
  programmeId?: string | null;
  now?: Date;
}

/** Schedules (or replaces) one reminder. Returns the job key and the time it will fire, or null when nothing is due. */
export async function scheduleReminder(tx: Tx, i: ScheduleReminderInput): Promise<{ jobKey: string; runAt: Date } | null> {
  const timings = await reminderTimings(i.organisationId, i.programmeId);
  const runAt = reminderRunAt(i.kind, i.eventAt, timings[MINUTES[i.kind]], i.now);
  const jobKey = reminderKey(i.template, i.subjectId, i.recipientId);
  if (!runAt) {
    await cancelJob(tx, jobKey, i.organisationId); // the event is over: remove a stale earlier reminder
    return null;
  }
  await enqueueInTx(tx, {
    organisationId: i.organisationId,
    task: "notify.fire",
    payload: { template: i.template, recipientId: i.recipientId, subjectId: i.subjectId, programmeId: i.programmeId ?? null, dedupeKey: `rem:${i.kind}:${Math.floor(i.eventAt.getTime() / 60_000)}` },
    runAt,
    jobKey,
  });
  return { jobKey, runAt };
}

/** Cancels a scheduled reminder (the session was cancelled, the proposal was answered …). */
export async function cancelReminder(tx: Tx, organisationId: string, template: string, subjectId: string, recipientId: string): Promise<boolean> {
  return cancelJob(tx, reminderKey(template, subjectId, recipientId), organisationId);
}
