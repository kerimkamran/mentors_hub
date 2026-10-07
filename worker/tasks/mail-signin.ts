import type { Task } from "graphile-worker";
import { env } from "../../src/lib/env";
import { renderSignInEmail } from "../../src/lib/emails";
import { createTransport } from "../../src/lib/mail";
import type { SignInMail } from "../../src/lib/jobs";

/** Sends the sign-in email (N-001). Logs nothing about the address, link or code. */
export const mailSignIn: Task = async (payload, helpers) => {
  const m = payload as SignInMail;
  const msg = renderSignInEmail(m);
  await createTransport().sendMail({ from: env().MAIL_FROM, to: m.to, subject: msg.subject, text: msg.text, html: msg.html });
  helpers.logger.info("mail.signin sent");
};
