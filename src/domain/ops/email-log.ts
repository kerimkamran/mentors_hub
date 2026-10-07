import { audit } from "@/lib/audit";
import { withOrg, type Tx } from "@/lib/db";
import { authorize, can, type Actor } from "@/lib/permissions";
import { queueEmail } from "@/domain/notifications/notify";
import { opsSettings } from "@/domain/notifications/settings";

export const DELIVERY_STATUSES = ["queued", "sent", "deferred", "bounced", "failed"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface DeliveryRow {
  id: string;
  templateCode: string;
  /** Only organisation admins see who the email was for (a PM sees status only). */
  recipientName: string | null;
  status: DeliveryStatus;
  errorCode: string | null;
  at: Date;
  canResend: boolean;
}

/** Programmes a PM may see delivery status for (programme grants, and the programmes of their cohort grants). */
async function pmProgrammeIds(tx: Tx, actor: Actor): Promise<string[]> {
  const ids = new Set(actor.roles.filter((g) => g.role === "pm" && g.scopeType === "programme" && g.scopeId).map((g) => g.scopeId!));
  const cohorts = actor.roles.filter((g) => g.role === "pm" && g.scopeType === "cohort" && g.scopeId).map((g) => g.scopeId!);
  if (cohorts.length) {
    const r = await tx.query<{ programme_id: string }>("SELECT DISTINCT programme_id FROM cohort WHERE id = ANY($1::uuid[])", [cohorts]);
    for (const x of r.rows) ids.add(x.programme_id);
  }
  return [...ids];
}

/**
 * The delivery log. Organisation admins see template code, recipient name, status, error code and time; a PM sees
 * template code, status and time for notifications of their own programmes. Never a subject, body, link or code
 * (AC-ADM-06.1/06.3/06.5): the table does not hold them.
 */
export async function listDeliveries(actor: Actor, limit = 100): Promise<DeliveryRow[]> {
  authorize(actor, "ops.email.view");
  const isAdmin = can(actor, "ops.email.resend");
  return withOrg(actor.organisationId, async (tx) => {
    const programmes = isAdmin ? null : await pmProgrammeIds(tx, actor);
    if (programmes && programmes.length === 0) return [];
    const r = await tx.query<{
      id: string; template_code: string; display_name: string | null; status: DeliveryStatus; error_code: string | null;
      at: Date; is_latest: boolean;
    }>(
      `SELECT d.id, d.template_code, p.display_name, d.status, d.error_code, COALESCE(d.attempted_at, d.queued_at) AS at,
              NOT EXISTS (SELECT 1 FROM delivery_attempt d2 WHERE d2.notification_id = d.notification_id AND d2.attempt_no > d.attempt_no) AS is_latest
         FROM delivery_attempt d
         JOIN notification n ON n.id = d.notification_id AND n.organisation_id = d.organisation_id
         LEFT JOIN person_profile p ON p.membership_id = n.recipient_id
        WHERE ($2::uuid[] IS NULL OR n.programme_id = ANY($2::uuid[]))
        ORDER BY d.queued_at DESC, d.id LIMIT $1`,
      [Math.min(Math.max(limit, 1), 500), programmes],
    );
    return r.rows.map((x) => ({
      id: x.id,
      templateCode: x.template_code,
      recipientName: isAdmin ? x.display_name : null,
      status: x.status,
      errorCode: isAdmin ? x.error_code : null,
      at: x.at,
      canResend: isAdmin && x.is_latest && (x.status === "bounced" || x.status === "failed"),
    }));
  });
}

export class NotResendable extends Error {
  constructor() {
    super("not_resendable");
  }
}

/**
 * One new attempt for a bounced or failed delivery. A delivered, queued or already-resent delivery is refused
 * (AC-ADM-06.2). The old attempt row is kept, so the log shows both. Audited by id.
 */
export async function resendDelivery(actor: Actor, deliveryId: string): Promise<string> {
  authorize(actor, "ops.email.resend");
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ status: DeliveryStatus; attempt_no: number; notification_id: string; template_code: string }>(
      "SELECT status, attempt_no, notification_id, template_code FROM delivery_attempt WHERE id = $1 FOR UPDATE",
      [deliveryId],
    );
    const row = r.rows[0];
    if (!row) throw new NotResendable();
    if (row.status !== "bounced" && row.status !== "failed") throw new NotResendable();
    const later = await tx.query("SELECT 1 FROM delivery_attempt WHERE notification_id = $1 AND attempt_no > $2", [row.notification_id, row.attempt_no]);
    if (later.rowCount) throw new NotResendable();
    const id = await queueEmail(tx, actor.organisationId, row.notification_id, row.template_code, row.attempt_no + 1);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "ops.email.resend", objectType: "delivery_attempt", objectId: id });
    return id;
  });
}

export interface BounceStatus {
  sends: number;
  bounced: number;
  percent: number;
  /** C-165: at least the minimum number of sends in the window AND the bounce rate at or above the threshold. */
  alert: boolean;
  threshold: { percent: number; minSends: number; windowHours: number };
}

/** Bounce-rate data model for the alert centre (AC-ADM-06.4). A "send" is a settled attempt (sent or bounced) in the window. */
export async function bounceStatus(tx: Tx, organisationId: string, now: Date = new Date()): Promise<BounceStatus> {
  const s = await opsSettings(organisationId);
  const r = await tx.query<{ sends: number; bounced: number }>(
    `SELECT count(*)::int AS sends, count(*) FILTER (WHERE status = 'bounced')::int AS bounced
       FROM delivery_attempt
      WHERE status IN ('sent', 'bounced') AND attempted_at > $1::timestamptz - make_interval(hours => $2)`,
    [now, s.bounceAlertWindowHours],
  );
  const { sends, bounced } = r.rows[0]!;
  const percent = sends === 0 ? 0 : (bounced * 100) / sends;
  return {
    sends,
    bounced,
    percent,
    alert: sends >= s.bounceAlertMinSends && percent >= s.bounceAlertPercent,
    threshold: { percent: s.bounceAlertPercent, minSends: s.bounceAlertMinSends, windowHours: s.bounceAlertWindowHours },
  };
}

export async function getBounceStatus(actor: Actor, now?: Date): Promise<BounceStatus> {
  authorize(actor, "ops.email.resend"); // organisation admins only
  return withOrg(actor.organisationId, (tx) => bounceStatus(tx, actor.organisationId, now));
}
