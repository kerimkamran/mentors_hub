import type { TemplateDef } from "../types";
import { isProgrammeStaff } from "../visibility";

/** N-012 · Programme activated (S3). In-app only. Programme name. */
export const template: TemplateDef = {
  code: "N-012",
  name: "Programme activated",
  slice: "S3",
  critical: false,
  channels: { email: false, inApp: true },
  recipients: "The PMs of the programme",
  subjectType: "programme",
  params: { programmeName: "name" },
  messages: {
    en: { inapp: "{programmeName} is now active." },
    az: { inapp: "«{programmeName}» proqramı aktivləşdirildi." },
    ru: { inapp: "Программа «{programmeName}» активирована." },
  },
  link: (id) => `/admin/programmes/${id}`,
  resolve: async ({ tx, recipient, subjectId }) => {
    if (!(await isProgrammeStaff(tx, recipient, subjectId))) return null;
    const p = await tx.query<{ name: string }>("SELECT name FROM programme WHERE id = $1", [subjectId]);
    return p.rows[0] ? { programmeName: p.rows[0].name } : null;
  },
  sample: { subjectId: "00000000-0000-4000-8000-000000000012", params: { programmeName: "SparkLab Spring 2027" } },
  limits: { subjectMaxChars: 0, bodyMaxChars: 200 },
};
