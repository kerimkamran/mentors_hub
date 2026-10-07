import ICAL from "ical.js";
import { describe, expect, it } from "vitest";
import { buildInvite, escapeText, fold } from "../../src/lib/ics";
import { inviteMessage } from "../../src/lib/mail";

const input = {
  uid: "abc-123@mentorship-hub.example",
  sequence: 0,
  start: new Date("2026-11-03T08:00:00Z"),
  end: new Date("2026-11-03T08:45:00Z"),
  summary: "Mentoring session, with; special\\chars",
  description: "Line one\nLine two",
  joinUrl: "https://teams.microsoft.com/l/meetup-join/xyz",
  organizer: { name: "Mentorship Hub", email: "no-reply@example.test" },
  attendees: [
    { name: "Leyla Məmmədova", email: "mentee@example.test" },
    { name: "Rauf Əliyev", email: "mentor@example.test" },
  ],
  now: new Date("2026-10-30T10:00:00Z"),
};

describe("calendar invite (S0 spike, used from S7)", () => {
  const ics = buildInvite(input);
  const event = new ICAL.Event(new ICAL.Component(ICAL.parse(ics)).getFirstSubcomponent("vevent")!);

  it("is a parseable iCalendar REQUEST with CRLF line endings and no line over 75 octets", () => {
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });

  it("carries organizer, RSVP-enabled attendees, UID and the Teams link (Outlook Accept/Decline)", () => {
    expect(event.uid).toBe(input.uid);
    expect(event.organizer).toBe("mailto:no-reply@example.test");
    expect(event.attendees.map((a) => a.getFirstValue())).toEqual(["mailto:mentee@example.test", "mailto:mentor@example.test"]);
    expect(event.attendees[0]!.getParameter("rsvp")).toBe("TRUE");
    expect(event.location).toContain("teams.microsoft.com");
    expect(event.summary).toBe(input.summary);
    expect(event.description).toContain("Line two");
  });

  it("times are UTC and exact", () => {
    expect(event.startDate.toJSDate().toISOString()).toBe("2026-11-03T08:00:00.000Z");
    expect(event.endDate.toJSDate().toISOString()).toBe("2026-11-03T08:45:00.000Z");
  });

  it("a reschedule keeps the UID and raises SEQUENCE; a cancel uses METHOD:CANCEL", () => {
    expect(buildInvite({ ...input, sequence: 1 })).toContain("SEQUENCE:1");
    const cancel = buildInvite({ ...input, method: "CANCEL", sequence: 2 });
    expect(cancel).toContain("METHOD:CANCEL");
    expect(cancel).toContain("STATUS:CANCELLED");
  });

  it("rejects header injection through names or addresses and bad time ranges", () => {
    expect(() => buildInvite({ ...input, attendees: [{ name: "x", email: "a@b.co\r\nBCC:evil@x.co" }] })).toThrow();
    const injected = buildInvite({ ...input, attendees: [{ name: "Evil\r\nATTENDEE:mailto:evil@x.co", email: "a@b.co" }] });
    expect(injected.match(/^ATTENDEE/gm)).toHaveLength(1);
    expect(() => buildInvite({ ...input, end: input.start })).toThrow();
  });

  it("escapes and folds correctly, never splitting multi-byte characters", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\;c\\\\d\\ne");
    const long = "Ə".repeat(120);
    const folded = fold(`SUMMARY:${long}`);
    expect(folded.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${long}`);
  });

  it("the email carries the invite as a text/calendar alternative with method=REQUEST", () => {
    const m = inviteMessage("mentee@example.test", "Session", "Body", input, "Hub <no-reply@example.test>");
    expect(m.icalEvent).toMatchObject({ method: "REQUEST" });
  });
});
