import { withOrg } from "@/lib/db";
import { loadRecipient } from "./recipient";
import { renderEmail } from "./render";
import { getTemplate } from "./registry";

/**
 * The delivery pipeline behind the mail.send job. It renders the email from the template + ids at send time, sends it,
 * and records ONLY status and an error code on delivery_attempt (INV-3: no address, subject, body or link is stored).
 */
export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}
export interface DeliveryDeps {
  send: (m: OutgoingMail) => Promise<void>;
  baseUrl?: string;
}

export type FinalStatus = "sent" | "deferred" | "bounced" | "failed";
export interface DeliveryOutcome {
  status: FinalStatus | "skipped";
  /** Error code (never a message). */
  code?: string;
  /** True when graphile-worker should retry the job (a deferred, non-final attempt). */
  retry: boolean;
}

const PERMANENT_RECIPIENT = new Set([550, 551, 552, 553, 554]);

/** Maps a transport error to a delivery status and a short code. Pure; reads only response/error codes, never text. */
export function classifySendError(err: unknown): { status: "deferred" | "bounced" | "failed"; code: string } {
  const e = (err ?? {}) as { responseCode?: unknown; code?: unknown };
  const rc = typeof e.responseCode === "number" ? e.responseCode : undefined;
  if (rc !== undefined) {
    if (PERMANENT_RECIPIENT.has(rc)) return { status: "bounced", code: `smtp_${rc}` };
    if (rc >= 500) return { status: "failed", code: `smtp_${rc}` }; // configuration or policy: retrying does not help
    if (rc >= 400) return { status: "deferred", code: `smtp_${rc}` };
  }
  const c = typeof e.code === "string" ? e.code.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30) : "";
  if (c === "eenvelope") return { status: "bounced", code: "envelope_rejected" };
  if (c === "eauth") return { status: "failed", code: "smtp_auth" };
  return { status: "deferred", code: c ? `net_${c}` : "send_error" };
}

async function record(organisationId: string, deliveryId: string, status: FinalStatus, code: string | null): Promise<void> {
  await withOrg(organisationId, (tx) =>
    tx.query(
      `UPDATE delivery_attempt SET status = $2, error_code = $3, transport_tries = transport_tries + 1, attempted_at = now() WHERE id = $1`,
      [deliveryId, status, code],
    ),
  );
}

/**
 * Sends one queued delivery. `attempt`/`maxAttempts` come from graphile-worker: a transient failure on the last attempt
 * becomes `failed`; earlier ones are `deferred` and ask for a retry with back-off (R9).
 */
export async function deliver(
  organisationId: string,
  deliveryId: string,
  run: { attempt: number; maxAttempts: number },
  deps: DeliveryDeps,
): Promise<DeliveryOutcome> {
  const prepared = await withOrg(organisationId, async (tx) => {
    const d = await tx.query<{ status: string; template_code: string; subject_id: string; actor_id: string | null; recipient_id: string }>(
      `SELECT d.status, n.template_code, n.subject_id, n.actor_id, n.recipient_id
         FROM delivery_attempt d JOIN notification n ON n.id = d.notification_id AND n.organisation_id = d.organisation_id
        WHERE d.id = $1`,
      [deliveryId],
    );
    const row = d.rows[0];
    if (!row || (row.status !== "queued" && row.status !== "deferred")) return { kind: "skip" as const };
    const def = getTemplate(row.template_code);
    const recipient = await loadRecipient(tx, row.recipient_id);
    if (!def || !def.channels.email) return { kind: "fail" as const, code: "template_unavailable" };
    if (!recipient || !(def.recipientStatuses ?? ["active"]).includes(recipient.status)) return { kind: "fail" as const, code: "recipient_inactive" };
    const params = await def.resolve({ tx, organisationId, recipient, subjectId: row.subject_id, actorId: row.actor_id });
    if (params === null) return { kind: "fail" as const, code: "object_unavailable" };
    const mail = renderEmail(def, row.subject_id, params, { locale: recipient.locale, timeZone: recipient.timeZone, baseUrl: deps.baseUrl });
    return { kind: "send" as const, mail: { to: recipient.email, subject: mail.subject, text: mail.text, html: mail.html } };
  });

  if (prepared.kind === "skip") return { status: "skipped", retry: false };
  if (prepared.kind === "fail") {
    await record(organisationId, deliveryId, "failed", prepared.code);
    return { status: "failed", code: prepared.code, retry: false };
  }
  try {
    await deps.send(prepared.mail);
  } catch (e) {
    const c = classifySendError(e);
    if (c.status === "deferred" && run.attempt < run.maxAttempts) {
      await record(organisationId, deliveryId, "deferred", c.code);
      return { status: "deferred", code: c.code, retry: true };
    }
    const status = c.status === "deferred" ? "failed" : c.status;
    await record(organisationId, deliveryId, status, c.code);
    return { status, code: c.code, retry: false };
  }
  await record(organisationId, deliveryId, "sent", null);
  return { status: "sent", retry: false };
}
