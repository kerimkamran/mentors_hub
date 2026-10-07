import type { TemplateDef } from "../types";

/** N-003 · TOTP enrolment reminder (S1). In-app only. A prompt, nothing else. */
export const template: TemplateDef = {
  code: "N-003",
  name: "Authenticator enrolment reminder",
  slice: "S1",
  critical: false,
  channels: { email: false, inApp: true },
  recipients: "An administrator who signs in without an authenticator app",
  subjectType: "membership",
  params: {},
  messages: {
    en: { inapp: "Set up your authenticator app to protect your administrator access." },
    az: { inapp: "İdarəçi girişinizi qorumaq üçün autentifikator tətbiqini qurun." },
    ru: { inapp: "Настройте приложение-аутентификатор, чтобы защитить доступ администратора." },
  },
  link: () => "/auth/totp",
  resolve: async ({ tx, recipient, subjectId }) => {
    if (subjectId !== recipient.membershipId) return null; // only about the recipient themselves
    const i = await tx.query<{ totp_enrolled_at: Date | null }>("SELECT totp_enrolled_at FROM identity WHERE id = $1", [recipient.identityId]);
    const needs = recipient.isPlatformAdmin || recipient.roles.some((g) => g.role === "org_admin");
    return needs && i.rows[0] && i.rows[0].totp_enrolled_at === null ? {} : null;
  },
  sample: { subjectId: "00000000-0000-4000-8000-000000000003", params: {} },
  limits: { subjectMaxChars: 0, bodyMaxChars: 200 },
};
