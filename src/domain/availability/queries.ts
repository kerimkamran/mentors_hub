import type { Tx } from "@/lib/db";
import { withOrg } from "@/lib/db";
import { authorize, type Actor } from "@/lib/permissions";
import { PREVIEW_SESSION_MINUTES, PREVIEW_WEEKS } from "../profiles/constants";
import { getBookedIntervals } from "./bookings";
import { describeSlot, freeIntervals, generateSlots, groupByLocalDate, slotsWithin, type Interval, type Slot, type WeeklyRule } from "./slots";

export interface StoredRule extends WeeklyRule { id: string }

interface RuleRow { id: string; membership_id: string; weekday: number; start_time: string; end_time: string; time_zone: string; valid_from: string | null; valid_to: string | null }

const hm = (t: string) => t.slice(0, 5);
const dateStr = (d: unknown): string | null => (d == null ? null : d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : String(d).slice(0, 10));
const toRule = (r: RuleRow): StoredRule => ({ id: r.id, weekday: r.weekday, start: hm(r.start_time), end: hm(r.end_time), timeZone: r.time_zone, validFrom: dateStr(r.valid_from), validTo: dateStr(r.valid_to) });

/** Internal: raw rules (mentors) and windows (mentees) of people. Callers apply field visibility or relationship rules themselves. */
export async function loadAvailability(tx: Tx, membershipIds: string[]): Promise<Map<string, { rules: StoredRule[]; windows: StoredRule[]; exceptions: Interval[] }>> {
  const out = new Map<string, { rules: StoredRule[]; windows: StoredRule[]; exceptions: Interval[] }>();
  for (const id of membershipIds) out.set(id, { rules: [], windows: [], exceptions: [] });
  if (membershipIds.length === 0) return out;
  // `date` columns come back as strings, not Date objects, so no time-zone shift can move a valid-from date.
  const cols = "id, membership_id, weekday, start_time::text, end_time::text, time_zone, valid_from::text, valid_to::text";
  const rules = await tx.query<RuleRow>(`SELECT ${cols} FROM availability_rule WHERE membership_id = ANY($1::uuid[]) ORDER BY weekday, start_time`, [membershipIds]);
  const wins = await tx.query<RuleRow>(`SELECT ${cols} FROM availability_window WHERE membership_id = ANY($1::uuid[]) ORDER BY weekday, start_time`, [membershipIds]);
  const exc = await tx.query<{ membership_id: string; starts_at: Date; ends_at: Date }>(
    "SELECT membership_id, starts_at, ends_at FROM availability_exception WHERE membership_id = ANY($1::uuid[]) AND ends_at > now() ORDER BY starts_at",
    [membershipIds],
  );
  for (const r of rules.rows) out.get(r.membership_id)!.rules.push(toRule(r));
  for (const r of wins.rows) out.get(r.membership_id)!.windows.push(toRule(r));
  for (const e of exc.rows) out.get(e.membership_id)!.exceptions.push({ start: e.starts_at, end: e.ends_at });
  return out;
}

export interface SlotQuery {
  from: Date;
  weeks?: number;
  durationMinutes?: number;
  stepMinutes?: number;
  viewerTimeZone: string;
}

/**
 * Slots a mentor offers, as UTC instants labelled in the viewer's zone (AC-PRF-03.1): weekly rules minus away periods and
 * existing bookings. Internal (no visibility filtering): booking inside a relationship (S7) and matching call this.
 */
export async function mentorSlots(tx: Tx, mentorMembershipId: string, q: SlotQuery): Promise<Slot[]> {
  const until = new Date(q.from.getTime() + (q.weeks ?? 4) * 7 * 86_400_000);
  const a = (await loadAvailability(tx, [mentorMembershipId])).get(mentorMembershipId)!;
  const bookings = await getBookedIntervals(tx, mentorMembershipId, q.from, until);
  return generateSlots({
    rules: a.rules, blocks: a.exceptions, bookings, durationMinutes: q.durationMinutes ?? PREVIEW_SESSION_MINUTES, stepMinutes: q.stepMinutes,
    from: q.from, until, viewerTimeZone: q.viewerTimeZone,
  });
}

/** A mentee's free time from their windows ("I'm usually free…"), as UTC intervals. */
export async function menteeFreeIntervals(tx: Tx, menteeMembershipId: string, from: Date, weeks = 4): Promise<Interval[]> {
  const until = new Date(from.getTime() + weeks * 7 * 86_400_000);
  const a = (await loadAvailability(tx, [menteeMembershipId])).get(menteeMembershipId)!;
  const free = freeIntervals(a.windows, from, until);
  // subtract away periods
  return free.flatMap((f) => subtract(f, a.exceptions));
}

function subtract(f: Interval, blocks: Interval[]): Interval[] {
  let parts: Interval[] = [f];
  for (const b of blocks) parts = parts.flatMap((p) => (b.end <= p.start || b.start >= p.end ? [p] : [...(b.start > p.start ? [{ start: p.start, end: b.start }] : []), ...(b.end < p.end ? [{ start: b.end, end: p.end }] : [])]));
  return parts;
}

/** Mentor slots that fall inside a mentee's windows (matching availability criterion and booking). */
export async function mutualSlots(tx: Tx, mentorId: string, menteeId: string, q: SlotQuery): Promise<Slot[]> {
  const slots = await mentorSlots(tx, mentorId, q);
  const free = await menteeFreeIntervals(tx, menteeId, q.from, q.weeks ?? 4);
  return slotsWithin(slots, free);
}

export interface AvailabilityPage {
  isMentor: boolean;
  isMentee: boolean;
  rules: StoredRule[];
  windows: StoredRule[];
  exceptions: { id: string; startsAt: Date; endsAt: Date }[];
  preview: { date: string; slots: Slot[] }[];
  capacities: CapacityRow[];
}

export interface CapacityRow {
  participationId: string;
  programmeId: string;
  programmeName: string;
  programmeType: "leadership" | "sparklab" | "open";
  capacity: number | null;
  load: number;
}

/** Everything SCR-04 shows for the signed-in person, preview in their own zone (next two weeks). */
export async function getAvailabilityPage(actor: Actor, now = new Date()): Promise<AvailabilityPage> {
  authorize(actor, "availability.read.own", { ownerMembershipId: actor.membershipId });
  return withOrg(actor.organisationId, async (tx) => {
    const parts = await tx.query<{ kind: string }>("SELECT kind FROM participation WHERE membership_id = $1 AND status <> 'withdrawn'", [actor.membershipId]);
    const kinds = new Set(parts.rows.map((r) => r.kind));
    const none = kinds.size === 0; // nobody to filter by yet: offer both so people can prepare
    const a = (await loadAvailability(tx, [actor.membershipId])).get(actor.membershipId)!;
    const exc = await tx.query<{ id: string; starts_at: Date; ends_at: Date }>(
      "SELECT id, starts_at, ends_at FROM availability_exception WHERE membership_id = $1 AND ends_at > $2 ORDER BY starts_at",
      [actor.membershipId, now],
    );
    const isMentor = kinds.has("mentor") || none;
    const isMentee = kinds.has("mentee") || kinds.has("team_member") || none;
    const q: SlotQuery = { from: now, weeks: PREVIEW_WEEKS, viewerTimeZone: actor.timeZone };
    let preview: { date: string; slots: Slot[] }[] = [];
    if (isMentor && a.rules.length > 0) preview = groupByLocalDate(await mentorSlots(tx, actor.membershipId, q));
    else if (isMentee && a.windows.length > 0) {
      // Mentee view: the free windows themselves (not bookable slots), in the viewer's zone.
      const until = new Date(now.getTime() + PREVIEW_WEEKS * 7 * 86_400_000);
      const free = freeIntervals(a.windows, now, until).flatMap((f) => subtract(f, a.exceptions));
      preview = groupByLocalDate(free.map((f) => describeSlot(f.start, f.end, actor.timeZone)));
    }
    const caps = isMentor ? await mentorCapacities(tx, actor.membershipId) : [];
    return {
      isMentor, isMentee, rules: a.rules, windows: a.windows,
      exceptions: exc.rows.map((e) => ({ id: e.id, startsAt: e.starts_at, endsAt: e.ends_at })),
      preview, capacities: caps,
    };
  });
}

/** The mentor's own capacity per participation with the current load (active or paused relationships/teams). */
export async function mentorCapacities(tx: Tx, membershipId: string): Promise<CapacityRow[]> {
  const r = await tx.query<{ id: string; programme_id: string; name: string; type: CapacityRow["programmeType"]; capacity: number | null; load: number }>(
    `SELECT p.id, pr.id AS programme_id, pr.name, pr.type, p.capacity,
            (SELECT count(DISTINCT rm.relationship_id)::int
               FROM relationship_member rm JOIN relationship rel ON rel.id = rm.relationship_id AND rel.organisation_id = rm.organisation_id
              WHERE rm.participation_id = p.id AND rm.role = 'mentor' AND rel.status IN ('active', 'paused')) AS load
       FROM participation p
       JOIN cohort c ON c.id = p.cohort_id AND c.organisation_id = p.organisation_id
       JOIN programme pr ON pr.id = c.programme_id AND pr.organisation_id = c.organisation_id
      WHERE p.membership_id = $1 AND p.kind = 'mentor' AND p.status <> 'withdrawn'
      ORDER BY pr.name`,
    [membershipId],
  );
  return r.rows.map((x) => ({ participationId: x.id, programmeId: x.programme_id, programmeName: x.name, programmeType: x.type, capacity: x.capacity, load: x.load }));
}
