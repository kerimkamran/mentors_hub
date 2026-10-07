import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import { env } from "./env";
import { buildInvite, type InviteInput } from "./ics";

export function createTransport(): Transporter {
  return nodemailer.createTransport(env().SMTP_URL);
}

/**
 * Message carrying a calendar invite. `icalEvent` makes nodemailer emit a multipart/alternative
 * part `text/calendar; method=REQUEST`, which is what Outlook needs to render Accept/Decline.
 */
export function inviteMessage(to: string, subject: string, text: string, invite: InviteInput, from: string): SendMailOptions {
  const method = invite.method ?? "REQUEST";
  return {
    from,
    to,
    subject,
    text,
    icalEvent: { method, content: buildInvite(invite), filename: "invite.ics" },
  };
}
