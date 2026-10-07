import { env } from "./env";
import type { SignInMail } from "./jobs";
import { renderEmail } from "@/domain/notifications/render";
import { getTemplate } from "@/domain/notifications/registry";

/**
 * N-001. The sign-in email is now a template in the notification registry (src/domain/notifications/templates/n-001.ts);
 * this wrapper keeps the original entry point for the mail.signin job. The link is a plain GET to a page with a
 * Continue button; opening it changes nothing (INV-5).
 */
export function renderSignInEmail(m: SignInMail, baseUrl = env().APP_BASE_URL) {
  const def = getTemplate("N-001")!;
  const r = renderEmail(def, "00000000-0000-4000-8000-000000000001", { token: m.token, code: m.code, minutes: m.minutes }, { locale: m.locale, baseUrl });
  return { subject: r.subject, text: r.text, html: r.html, link: r.link };
}
