/**
 * Standards-compliant calendar invite builder (RFC 5545 / iTIP, slice S0 spike → used from S7).
 * METHOD:REQUEST with an ORGANIZER and RSVP-enabled ATTENDEEs is what makes Outlook show
 * Accept / Decline / Tentative; the Teams link goes in LOCATION, URL and DESCRIPTION.
 * No participant content is ever placed in an invite beyond names, time and the join link.
 */
export interface InviteInput {
  uid: string;
  sequence: number; // increments on reschedule; the same UID updates the existing event
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  joinUrl?: string;
  organizer: { name: string; email: string };
  attendees: { name: string; email: string }[];
  method?: "REQUEST" | "CANCEL";
  now?: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function formatUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Escape TEXT values (RFC 5545 §3.3.11). */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines at 75 octets, never splitting a UTF-8 sequence (RFC 5545 §3.1). */
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = "";
      curBytes = 0;
      limit = 74; // continuation lines start with one space
    }
    cur += ch;
    curBytes += b;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

function assertEmail(e: string) {
  if (!/^[^\s@<>",;:]+@[^\s@<>",;:]+\.[^\s@<>",;:]+$/.test(e)) throw new Error("invalid email address in invite");
}
const cn = (name: string) => `"${name.replace(/["\\\r\n;:,]/g, " ")}"`;

export function buildInvite(i: InviteInput): string {
  if (i.end <= i.start) throw new Error("invite end must be after start");
  assertEmail(i.organizer.email);
  i.attendees.forEach((a) => assertEmail(a.email));
  const method = i.method ?? "REQUEST";
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Azerconnect Group//Mentorship Hub//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${i.uid}`,
    `SEQUENCE:${i.sequence}`,
    `DTSTAMP:${formatUtc(i.now ?? new Date())}`,
    `DTSTART:${formatUtc(i.start)}`,
    `DTEND:${formatUtc(i.end)}`,
    `SUMMARY:${escapeText(i.summary)}`,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `ORGANIZER;CN=${cn(i.organizer.name)}:mailto:${i.organizer.email}`,
    ...i.attendees.map(
      (a) => `ATTENDEE;CN=${cn(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`,
    ),
  ];
  const desc = [i.description, i.joinUrl ? `Join: ${i.joinUrl}` : undefined].filter(Boolean).join("\n");
  if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`);
  if (i.joinUrl) {
    lines.push(`LOCATION:${escapeText(i.joinUrl)}`, `URL:${i.joinUrl}`);
  }
  lines.push("TRANSP:OPAQUE", "END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
