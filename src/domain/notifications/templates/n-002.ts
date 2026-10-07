import type { TemplateDef } from "../types";
import { displayName } from "../visibility";

/** N-002 · Invitation (S1/S2). Email. Organisation, programme, inviter name, link to the welcome page. Not critical. */
export const template: TemplateDef = {
  code: "N-002",
  name: "Invitation",
  slice: "S1",
  critical: false,
  channels: { email: true, inApp: false },
  recipients: "The invitee (a PM explicitly invites a person)",
  subjectType: "participation",
  recipientStatuses: ["invited", "active"],
  params: { organisationName: "name", programmeName: "name", inviterName: "name" },
  messages: {
    en: {
      subject: "You are invited to Mentorship Hub",
      body: "{inviterName} has invited you to join {programmeName} at {organisationName} on Mentorship Hub.\n\nOpen the welcome page: {link}",
    },
    az: {
      subject: "Mentorluq Mərkəzinə dəvətiniz var",
      body: "{inviterName} sizi {organisationName} təşkilatında «{programmeName}» proqramına qoşulmağa dəvət etdi.\n\nXoş gəlmisiniz səhifəsini açın: {link}",
    },
    ru: {
      subject: "Вас пригласили в Центр наставничества",
      body: "{inviterName} приглашает вас присоединиться к программе «{programmeName}» ({organisationName}).\n\nОткройте страницу приветствия: {link}",
    },
  },
  // The welcome page is the home page until the programmes slice adds a dedicated route; it asks the person to sign in.
  link: () => "/",
  resolve: async ({ tx, recipient, subjectId, actorId }) => {
    const r = await tx.query<{ programme_name: string; org_name: string }>(
      `SELECT pr.name AS programme_name, o.name AS org_name
         FROM participation p
         JOIN cohort c ON c.id = p.cohort_id AND c.organisation_id = p.organisation_id
         JOIN programme pr ON pr.id = c.programme_id AND pr.organisation_id = c.organisation_id
         JOIN organisation o ON o.id = p.organisation_id
        WHERE p.id = $1 AND p.membership_id = $2`,
      [subjectId, recipient.membershipId],
    );
    const row = r.rows[0];
    if (!row) return null;
    const inviter = (await displayName(tx, actorId)) ?? row.org_name;
    return { organisationName: row.org_name, programmeName: row.programme_name, inviterName: inviter };
  },
  sample: { subjectId: "00000000-0000-4000-8000-000000000002", params: { organisationName: "Example Group", programmeName: "Leadership Programme 2027", inviterName: "Aysel Hasanova" } },
  limits: { subjectMaxChars: 60, bodyMaxChars: 500 },
};
