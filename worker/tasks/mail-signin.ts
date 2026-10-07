import type { Task } from "graphile-worker";
import { env } from "../../src/lib/env";
import { renderSignInEmail } from "../../src/lib/emails";
import { createTransport } from "../../src/lib/mail";
import type { SignInMail } from "../../src/lib/jobs";

/** Sends the sign-in email (N-001). Logs nothing about the address, link or code. */
export const mailSignIn: Task = async (payload, helpers) => {
  const m = payload as SignInMail;
  const msg = renderSignInEmail(m);
  // STAGING ONLY (synthetic demo organisation): no mail server is connected yet, so the sign-in link and code
  // go to the private worker log instead. Refuses to act unless the demo seed flag is also set (INV-8).
  if (process.env.STAGING_MAIL_LOG === "1" && process.env.DEMO_SEED === "1") {
    helpers.logger.warn(`STAGING sign-in for ${m.to}: code ${m.code} link ${msg.link}`);
    return;
  }
  await createTransport().sendMail({ from: env().MAIL_FROM, to: m.to, subject: msg.subject, text: msg.text, html: msg.html });
  helpers.logger.info("mail.signin sent");
};
