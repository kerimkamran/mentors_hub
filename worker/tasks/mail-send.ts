import type { Task } from "graphile-worker";
import { deliver } from "../../src/domain/notifications/delivery";
import { env } from "../../src/lib/env";
import { createTransport } from "../../src/lib/mail";
import { JobError } from "../job-run";

let transport: ReturnType<typeof createTransport> | undefined;

/**
 * mail.send {organisationId, deliveryId}: renders the notification email from its template + ids, sends it, and records
 * status and error code on delivery_attempt. Transient failures retry with graphile-worker's back-off; permanent ones
 * are recorded as bounced/failed and the job ends (R9). Logs nothing about the address, subject or body.
 */
export const mailSend: Task = async (payload, helpers) => {
  const p = payload as { organisationId: string; deliveryId: string };
  const outcome = await deliver(
    p.organisationId,
    p.deliveryId,
    { attempt: helpers.job.attempts, maxAttempts: helpers.job.max_attempts },
    {
      send: async (m) => {
        transport ??= createTransport();
        await transport.sendMail({ from: env().MAIL_FROM, to: m.to, subject: m.subject, text: m.text, html: m.html });
      },
    },
  );
  helpers.logger.info(`mail.send ${outcome.status}`);
  if (outcome.retry) throw new JobError(outcome.code ?? "send_error");
};
