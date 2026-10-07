/**
 * Pure slot generation (FR-PRF-007, FR-SCH-001, AC-PRF-03.1). No clock, no database, no randomness:
 * everything the result depends on is in the request, so results are reproducible and testable.
 *
 * Inputs: weekly rules (local wall-clock windows in the rule owner's zone, with optional validity dates),
 * blocks (away periods), existing bookings, a session duration, a horizon, and the viewer's time zone.
 * Output: slots as UTC instants plus the viewer's local rendering for grouping and display.
 *
 * DST: see ./tz.ts. A rule "09:00-12:00 Europe/London" is 09:00-12:00 local on every date, so its UTC
 * instants shift when the clocks change; spring-forward gap times move forward, fall-back overlap times
 * resolve to the first occurrence.
 */
import { addDays, isoWeekday, localDate, localParts, parseHm, parseYmd, ymdKey, zonedToUtc, type YmdDate } from "./tz";

export interface WeeklyRule {
  /** ISO weekday, Monday = 1 ... Sunday = 7 (C-111). */
  weekday: number;
  /** Local wall-clock "HH:MM" in `timeZone`; end must be after start (24:00 allowed). */
  start: string;
  end: string;
  timeZone: string;
  /** Inclusive calendar dates ("YYYY-MM-DD", in the rule's zone). */
  validFrom?: string | null;
  validTo?: string | null;
}

export interface Interval {
  start: Date;
  end: Date;
}

export interface SlotRequest {
  rules: WeeklyRule[];
  /** Away periods (exceptions). Any slot overlapping one is removed. */
  blocks?: Interval[];
  /** Existing bookings of the rule owner. Any slot overlapping one is removed (AC-PRF-03.4 never touches the bookings themselves). */
  bookings?: Interval[];
  durationMinutes: number;
  /** Slots start every `stepMinutes` from the start of each rule window (default 30). */
  stepMinutes?: number;
  /** Earliest instant a slot may start (typically now + notice). */
  from: Date;
  /** Horizon end, exclusive: a slot must END at or before it. */
  until: Date;
  /** Zone used to label and group slots for the person looking at them. */
  viewerTimeZone: string;
}

export interface Slot {
  start: Date;
  end: Date;
  /** ISO-8601 UTC instants. */
  startUtc: string;
  endUtc: string;
  /** In the viewer's zone. */
  localDate: string; // YYYY-MM-DD
  localStart: string; // HH:MM
  localEnd: string; // HH:MM
  /** Monday = 1 ... Sunday = 7, in the viewer's zone. */
  localWeekday: number;
}

const MIN = 60_000;

export function validateRule(r: WeeklyRule): string | null {
  if (!Number.isInteger(r.weekday) || r.weekday < 1 || r.weekday > 7) return "weekday";
  try {
    const s = parseHm(r.start);
    const e = parseHm(r.end);
    if (e <= s) return "range";
  } catch {
    return "time";
  }
  if (r.validFrom && r.validTo && r.validTo < r.validFrom) return "validity";
  return null;
}

/** The local windows of ONE rule that start on any local date overlapping [from, until), as UTC intervals (not yet trimmed). */
function ruleWindows(rule: WeeklyRule, from: Date, until: Date): Interval[] {
  const out: Interval[] = [];
  const s = parseHm(rule.start);
  const e = parseHm(rule.end);
  // Pad one day each side: the local date of `from` in the rule's zone may differ from the viewer's.
  let day: YmdDate = addDays(localDate(from, rule.timeZone), -1);
  const last: YmdDate = addDays(localDate(until, rule.timeZone), 1);
  const lastKey = ymdKey(last);
  const vf = rule.validFrom ? ymdKey(parseYmd(rule.validFrom)) : null;
  const vt = rule.validTo ? ymdKey(parseYmd(rule.validTo)) : null;
  for (let guard = 0; guard < 800 && ymdKey(day) <= lastKey; guard++, day = addDays(day, 1)) {
    if (isoWeekday(day) !== rule.weekday) continue;
    const k = ymdKey(day);
    if ((vf && k < vf) || (vt && k > vt)) continue;
    const start = zonedToUtc(day.year, day.month, day.day, s, rule.timeZone);
    const end = e === 24 * 60 ? zonedToUtc(addDays(day, 1).year, addDays(day, 1).month, addDays(day, 1).day, 0, rule.timeZone) : zonedToUtc(day.year, day.month, day.day, e, rule.timeZone);
    if (end > start) out.push({ start, end });
  }
  return out;
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** Merge overlapping or touching intervals. */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) {
      if (i.end > last.end) last.end = i.end;
    } else out.push({ start: i.start, end: i.end });
  }
  return out;
}

/** Free time implied by the rules inside [from, until), clipped to it. Used for mentee windows ("I'm usually free…"). */
export function freeIntervals(rules: WeeklyRule[], from: Date, until: Date): Interval[] {
  const all: Interval[] = [];
  for (const r of rules) {
    if (validateRule(r) !== null) continue; // an invalid rule never yields time
    for (const w of ruleWindows(r, from, until)) {
      const start = w.start < from ? from : w.start;
      const end = w.end > until ? until : w.end;
      if (end > start) all.push({ start, end });
    }
  }
  return mergeIntervals(all);
}

export function describeSlot(start: Date, end: Date, viewerTimeZone: string): Slot {
  const a = localParts(start, viewerTimeZone);
  const b = localParts(end, viewerTimeZone);
  const hm = (p: { hour: number; minute: number }) => `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  const d = { year: a.year, month: a.month, day: a.day };
  return {
    start, end, startUtc: start.toISOString(), endUtc: end.toISOString(),
    localDate: ymdKey(d), localStart: hm(a), localEnd: hm(b), localWeekday: isoWeekday(d),
  };
}

export function generateSlots(req: SlotRequest): Slot[] {
  const duration = req.durationMinutes;
  const step = req.stepMinutes ?? 30;
  if (!Number.isInteger(duration) || duration < 5 || duration > 8 * 60) throw new Error("durationMinutes must be an integer between 5 and 480");
  if (!Number.isInteger(step) || step < 5 || step > 8 * 60) throw new Error("stepMinutes must be an integer between 5 and 480");
  if (!(req.until > req.from)) return [];
  const busy: Interval[] = [...(req.blocks ?? []), ...(req.bookings ?? [])];
  const seen = new Set<number>();
  const slots: Slot[] = [];
  for (const rule of req.rules) {
    if (validateRule(rule) !== null) continue;
    for (const w of ruleWindows(rule, req.from, req.until)) {
      for (let t = w.start.getTime(); t + duration * MIN <= w.end.getTime(); t += step * MIN) {
        const start = new Date(t);
        const end = new Date(t + duration * MIN);
        if (start < req.from || end > req.until) continue; // horizon cut-off
        if (seen.has(t)) continue; // overlapping rules offer one slot, not two
        const candidate = { start, end };
        if (busy.some((b) => overlaps(candidate, b))) continue;
        seen.add(t);
        slots.push(describeSlot(start, end, req.viewerTimeZone));
      }
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Slots that lie completely inside one of the free intervals (mentor slots × mentee windows, matching and booking). */
export function slotsWithin(slots: Slot[], free: Interval[]): Slot[] {
  return slots.filter((s) => free.some((f) => f.start <= s.start && s.end <= f.end));
}

/** Slots grouped by the viewer's local calendar date, in order. */
export function groupByLocalDate(slots: Slot[]): { date: string; slots: Slot[] }[] {
  const m = new Map<string, Slot[]>();
  for (const s of slots) (m.get(s.localDate) ?? m.set(s.localDate, []).get(s.localDate)!).push(s);
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, list]) => ({ date, slots: list }));
}

/** Number of distinct viewer-local days that have at least one slot (matching "availability" criterion input). */
export const daysWithSlots = (slots: Slot[]): number => new Set(slots.map((s) => s.localDate)).size;
