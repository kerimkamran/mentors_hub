import type { Tx } from "@/lib/db";
import { NOTIFICATION_DEFAULTS } from "@/lib/constants-notifications";
import { enqueueInTx } from "./queue";
import { getTemplate } from "./registry";
import { loadRecipient } from "./recipient";

export interface NotifyInput {
  organisationId: string;
  /** Catalogue id, e.g. "N-033". */
  template: string;
  /** Membership id of the recipient. */
  recipientId: string;
  /** The object the notification is about (a programme, a session, a proposal …). */
  subjectId: string;
  /** Membership that triggered it, when a template shows their name. */
  actorId?: string | null;
  /** Lets a PM see delivery status for their own programmes (AC-ADM-06.5). */
  programmeId?: string | null;
  /**
   * Makes a repeated trigger a no-op: same recipient + template + subject + key is delivered once. Without a key the
   * same trio inside the dedupe window counts as the same notification.
   */
  dedupeKey?: string;
}

export type SkipReason = "unknown_recipient" | "recipient_inactive" | "cannot_see" | "duplicate" | "preference_off";

export type NotifyResult =
  | { status: "created"; notificationId: string; email: "queued" | "off" | "none" }
  | { status: "skipped"; reason: SkipReason };

/**
 * THE way to notify. Call inside the same `withOrg` transaction as the change that triggers it, so the notification
 * and the email job exist if and only if the change committed. Applies the catalogue rules:
 *   R1 ids only · R5 recipient language at render time · R6 never for an object the recipient cannot see (the
 *   template's resolve() decides) · R7 channels · R8 critical templates ignore preferences, others respect the
 *   per-person email switch (in-app items are still delivered) · dedupe · inactive recipients get nothing.
 * Email text is NEVER built here; the mail.send job renders it from the template and the ids when it runs.
 */
export async function notify(tx: Tx, input: NotifyInput): Promise<NotifyResult> {
  const def = getTemplate(input.template);
  if (!def) throw new Error(`unknown notification template ${input.template}`);
  if (def.direct) throw new Error(`${def.code} is rendered directly and cannot be notified`);

  const recipient = await loadRecipient(tx, input.recipientId);
  if (!recipient) return { status: "skipped", reason: "unknown_recipient" };
  if (!(def.recipientStatuses ?? ["active"]).includes(recipient.status)) return { status: "skipped", reason: "recipient_inactive" };

  // R6: the template decides, from the database, whether this person may see the object. Null also covers a missing object.
  const params = await def.resolve({ tx, organisationId: input.organisationId, recipient, subjectId: input.subjectId, actorId: input.actorId ?? null });
  if (params === null) return { status: "skipped", reason: "cannot_see" };

  // R8: preference only matters for the email channel of a non-critical template.
  let emailOn = def.channels.email;
  if (emailOn && !def.critical) {
    const pref = await tx.query<{ email_enabled: boolean }>(
      "SELECT email_enabled FROM notification_preference WHERE membership_id = $1 AND template_code = $2",
      [recipient.membershipId, def.code],
    );
    if (pref.rows[0] && !pref.rows[0].email_enabled) emailOn = false;
  }
  if (!def.channels.inApp && !emailOn) return { status: "skipped", reason: "preference_off" };

  // Serialise concurrent identical triggers so the duplicate check cannot race.
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${recipient.membershipId}|${def.code}|${input.subjectId}`]);
  if (input.dedupeKey) {
    const dup = await tx.query(
      "SELECT 1 FROM notification WHERE recipient_id = $1 AND template_code = $2 AND subject_id = $3 AND dedupe_key = $4",
      [recipient.membershipId, def.code, input.subjectId, input.dedupeKey],
    );
    if (dup.rowCount) return { status: "skipped", reason: "duplicate" };
  } else {
    const dup = await tx.query(
      `SELECT 1 FROM notification WHERE recipient_id = $1 AND template_code = $2 AND subject_id = $3 AND dedupe_key IS NULL
         AND created_at > now() - make_interval(mins => $4)`,
      [recipient.membershipId, def.code, input.subjectId, NOTIFICATION_DEFAULTS.dedupeWindowMinutes],
    );
    if (dup.rowCount) return { status: "skipped", reason: "duplicate" };
  }

  const n = await tx.query<{ id: string }>(
    `INSERT INTO notification (organisation_id, recipient_id, template_code, subject_type, subject_id, actor_id, programme_id, dedupe_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [input.organisationId, recipient.membershipId, def.code, def.subjectType, input.subjectId, input.actorId ?? null, input.programmeId ?? null, input.dedupeKey ?? null],
  );
  const notificationId = n.rows[0]!.id;

  if (!emailOn) return { status: "created", notificationId, email: def.channels.email ? "off" : "none" };
  await queueEmail(tx, input.organisationId, notificationId, def.code, 1);
  return { status: "created", notificationId, email: "queued" };
}

/** Creates the delivery_attempt row (status queued) and the mail.send job. Used by notify() and by "Resend". */
export async function queueEmail(tx: Tx, organisationId: string, notificationId: string, templateCode: string, attemptNo: number): Promise<string> {
  const d = await tx.query<{ id: string }>(
    `INSERT INTO delivery_attempt (organisation_id, notification_id, template_code, attempt_no) VALUES ($1, $2, $3, $4) RETURNING id`,
    [organisationId, notificationId, templateCode, attemptNo],
  );
  const deliveryId = d.rows[0]!.id;
  await enqueueInTx(tx, { organisationId, task: "mail.send", payload: { deliveryId }, maxAttempts: NOTIFICATION_DEFAULTS.mailMaxAttempts });
  return deliveryId;
}
