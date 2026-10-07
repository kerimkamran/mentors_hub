import { programmeSponsorNames } from "../sources";
import type { TemplateDef } from "../types";
import { isProgrammeParticipant } from "../visibility";

/** N-011 · Enrolment confirmation (S3). Email + in-app. Programme name and the sponsors' names (FR-PRG-007), link to the programme page. */
export const template: TemplateDef = {
  code: "N-011",
  name: "Enrolment confirmation",
  slice: "S3",
  critical: false,
  channels: { email: true, inApp: true },
  recipients: "The participant who was enrolled",
  subjectType: "programme",
  params: { programmeName: "name", sponsorCount: "count", sponsors: "name" },
  messages: {
    en: {
      subject: "You are enrolled in a programme",
      body: "You are enrolled in {programmeName}.{sponsorCount, plural, =0{} one{ Sponsor: {sponsors}.} other{ Sponsors: {sponsors}.}}\n\nOpen the programme: {link}",
      inapp: "You are enrolled in {programmeName}.",
    },
    az: {
      subject: "Siz proqrama qeydiyyatdan keçdiniz",
      body: "Siz «{programmeName}» proqramına qəbul olundunuz.{sponsorCount, plural, =0{} one{ Sponsor: {sponsors}.} other{ Sponsorlar: {sponsors}.}}\n\nProqrama baxın: {link}",
      inapp: "Siz «{programmeName}» proqramına qəbul olundunuz.",
    },
    ru: {
      subject: "Вы зачислены в программу",
      body: "Вы зачислены в программу «{programmeName}».{sponsorCount, plural, =0{} one{ Спонсор: {sponsors}.} few{ Спонсоры: {sponsors}.} many{ Спонсоры: {sponsors}.} other{ Спонсоры: {sponsors}.}}\n\nОткройте программу: {link}",
      inapp: "Вы зачислены в программу «{programmeName}».",
    },
  },
  link: (id) => `/programmes/${id}`,
  resolve: async ({ tx, recipient, subjectId }) => {
    if (!(await isProgrammeParticipant(tx, recipient.membershipId, subjectId))) return null;
    const p = await tx.query<{ name: string }>("SELECT name FROM programme WHERE id = $1", [subjectId]);
    if (!p.rows[0]) return null;
    const sponsors = await programmeSponsorNames(tx, subjectId);
    const list = new Intl.ListFormat(recipient.locale === "az" ? "az-AZ" : recipient.locale, { style: "long", type: "conjunction" }).format(sponsors);
    return { programmeName: p.rows[0].name, sponsorCount: sponsors.length, sponsors: list };
  },
  sample: { subjectId: "00000000-0000-4000-8000-000000000011", params: { programmeName: "Leadership Programme 2027", sponsorCount: 2, sponsors: "Nigar Aliyeva and Rauf Mammadov" } },
  limits: { subjectMaxChars: 60, bodyMaxChars: 500 },
};
