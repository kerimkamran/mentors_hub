import { inScope } from "@/domain/announcements/scope";
import type { TemplateDef } from "../types";

/**
 * N-086 · Announcement posted (S3, added by this slice: the catalogue has no code for the optional "also notify" email
 * of US-ADM-18, AC-ADM-18.4). Email + in-app. The email carries a LINK ONLY: it never contains the announcement text.
 */
export const template: TemplateDef = {
  code: "N-086",
  name: "Announcement posted",
  slice: "S3",
  critical: false,
  channels: { email: true, inApp: true },
  recipients: "People in the announcement's scope, when the author chose \"also notify\"",
  subjectType: "announcement",
  params: {},
  messages: {
    en: {
      subject: "There is a new announcement",
      body: "A new announcement was posted in Mentorship Hub.\n\nRead it here: {link}",
      inapp: "A new announcement was posted.",
    },
    az: {
      subject: "Yeni elan var",
      body: "Mentorluq Mərkəzində yeni elan yerləşdirildi.\n\nOnu burada oxuyun: {link}",
      inapp: "Yeni elan yerləşdirildi.",
    },
    ru: {
      subject: "Есть новое объявление",
      body: "В Центре наставничества опубликовано новое объявление.\n\nПрочитайте его здесь: {link}",
      inapp: "Опубликовано новое объявление.",
    },
  },
  link: (id) => `/announcements/${id}`,
  resolve: async ({ tx, recipient, subjectId }) => {
    const a = await tx.query<{ scope_type: "org" | "programme"; programme_id: string | null }>(
      "SELECT scope_type, programme_id FROM announcement WHERE id = $1",
      [subjectId],
    );
    const row = a.rows[0];
    if (!row) return null;
    return (await inScope(tx, recipient, { scopeType: row.scope_type, programmeId: row.programme_id })) ? {} : null;
  },
  sample: { subjectId: "00000000-0000-4000-8000-000000000086", params: {} },
  limits: { subjectMaxChars: 60, bodyMaxChars: 300 },
};
