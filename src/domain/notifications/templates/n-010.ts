import { importRunCounts } from "../sources";
import type { TemplateDef } from "../types";

/** N-010 · Import finished (S2). Email + in-app. Counts only. The counts come from S2's import run through sources.ts. */
export const template: TemplateDef = {
  code: "N-010",
  name: "Import finished",
  slice: "S2",
  critical: false,
  channels: { email: true, inApp: true },
  recipients: "The PM or admin who confirmed the import",
  subjectType: "import_run",
  params: { created: "count", updated: "count", rejected: "count" },
  messages: {
    en: {
      subject: "Your people import has finished",
      body: "Your people import has finished: {created} created, {updated} updated. Rejected rows: {rejected, plural, =0{none} one{# row} other{# rows}}.\n\nSee the result: {link}",
      inapp: "Import finished: {created} created, {updated} updated, {rejected, plural, =0{none rejected} one{# row rejected} other{# rows rejected}}.",
    },
    az: {
      subject: "İdxalınız tamamlandı",
      body: "Əməkdaşların idxalı tamamlandı: {created} yaradıldı, {updated} yeniləndi. Rədd edilən sətirlər: {rejected, plural, =0{yoxdur} one{# sətir} other{# sətir}}.\n\nNəticəyə baxın: {link}",
      inapp: "İdxal tamamlandı: {created} yaradıldı, {updated} yeniləndi, {rejected, plural, =0{rədd edilən yoxdur} one{# sətir rədd edildi} other{# sətir rədd edildi}}.",
    },
    ru: {
      subject: "Импорт завершён",
      body: "Импорт сотрудников завершён: создано {created}, обновлено {updated}. Отклонённые строки: {rejected, plural, =0{нет} one{# строка} few{# строки} many{# строк} other{# строки}}.\n\nСмотрите результат: {link}",
      inapp: "Импорт завершён: создано {created}, обновлено {updated}, {rejected, plural, =0{отклонённых нет} one{отклонена # строка} few{отклонено # строки} many{отклонено # строк} other{отклонено # строки}}.",
    },
  },
  link: (id) => `/admin/imports/${id}`,
  resolve: async ({ tx, recipient, subjectId }) => {
    const c = await importRunCounts(tx, subjectId, recipient.membershipId);
    return c ? { created: c.created, updated: c.updated, rejected: c.rejected } : null;
  },
  sample: { subjectId: "00000000-0000-4000-8000-000000000010", params: { created: 120, updated: 8, rejected: 21 } },
  limits: { subjectMaxChars: 60, bodyMaxChars: 400 },
};
