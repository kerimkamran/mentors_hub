import type { TemplateDef } from "../types";

/**
 * N-001 · Sign-in link and code (S1). CRITICAL, email only. DIRECT: rendered by the mail.signin job from its short-lived
 * payload (the link token is not stored anywhere readable), so it never creates a notification row. The link is a plain
 * GET to a page with a Continue button; opening it changes nothing (R3, INV-5).
 */
export const template: TemplateDef = {
  code: "N-001",
  name: "Sign-in link and code",
  slice: "S1",
  critical: true,
  channels: { email: true, inApp: false },
  recipients: "The person who asked to sign in (only if the identity is allowed)",
  subjectType: "identity",
  direct: true,
  params: { token: "token", code: "code", minutes: "count" },
  messages: {
    en: {
      subject: "Your Mentorship Hub sign-in link",
      body: "Use this link to sign in:\n{link}\n\nOr enter this code in the browser where you asked to sign in: {code}\n\nThe link and code expire in {minutes} minutes and work once. If you did not ask for this, you can ignore this email.",
    },
    az: {
      subject: "Mentorluq Mərkəzinə daxilolma keçidiniz",
      body: "Daxil olmaq üçün bu keçiddən istifadə edin:\n{link}\n\nVə ya daxilolmanı istədiyiniz brauzerdə bu kodu daxil edin: {code}\n\nKeçid və kodun müddəti {minutes} dəqiqədən sonra bitir və yalnız bir dəfə işləyir. Bunu siz istəməmisinizsə, bu e-məktubu nəzərə almaya bilərsiniz.",
    },
    ru: {
      subject: "Ваша ссылка для входа в Центр наставничества",
      body: "Используйте эту ссылку для входа:\n{link}\n\nИли введите этот код в браузере, в котором вы запрашивали вход: {code}\n\nСсылка и код действуют {minutes} мин. и работают один раз. Если вы не запрашивали вход, просто проигнорируйте это письмо.",
    },
  },
  link: (_id, p) => `/auth/verify?t=${encodeURIComponent(String(p.token))}`,
  resolve: async () => null,
  sample: { subjectId: "00000000-0000-4000-8000-000000000001", params: { token: "sample-token-0123456789abcdef", code: "123456", minutes: 15 } },
  limits: { subjectMaxChars: 60, bodyMaxChars: 600 },
};
