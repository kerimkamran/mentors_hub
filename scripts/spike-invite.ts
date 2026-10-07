/**
 * Spike: send a real calendar invite to Mailpit (http://localhost:8025) so it can be opened in
 * Outlook (classic, new, web, mobile) and Google Calendar. The Outlook Accept/Decline check
 * is MANUAL — it cannot be automated from CI. Record the result in docs/spikes.md.
 *   npm run spike:invite
 */
import { createTransport, inviteMessage } from "../src/lib/mail";

const start = new Date(Date.now() + 3 * 24 * 3600 * 1000);
start.setUTCMinutes(0, 0, 0);
const msg = inviteMessage(
  "mentee@example.test",
  "Mentoring session — Leyla & Rauf",
  "Your mentoring session is booked. Open the attached invite to accept.",
  {
    uid: `spike-${Date.now()}@mentorship-hub.example`,
    sequence: 0,
    start,
    end: new Date(start.getTime() + 45 * 60 * 1000),
    summary: "Mentoring session",
    description: "Prepared agenda is in Mentorship Hub.",
    joinUrl: "https://teams.microsoft.com/l/meetup-join/spike-example",
    organizer: { name: "Mentorship Hub", email: "no-reply@example.test" },
    attendees: [
      { name: "Leyla Məmmədova", email: "mentee@example.test" },
      { name: "Rauf Əliyev", email: "mentor@example.test" },
    ],
  },
  process.env.MAIL_FROM ?? "Mentorship Hub <no-reply@example.test>",
);
const info = await createTransport().sendMail(msg);
console.log("sent", info.messageId, "→ open http://localhost:8025");
