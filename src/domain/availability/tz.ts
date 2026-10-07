/**
 * Time-zone arithmetic without a library: local wall-clock time in an IANA zone <-> UTC instants.
 * Pure (no clock, no database). DST rules used everywhere in the availability module:
 *   - a local time that does not exist (spring-forward gap) moves FORWARD by the gap (02:30 -> 03:30);
 *   - a local time that occurs twice (fall-back overlap) means the FIRST occurrence.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function fmt(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== "string" || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    fmt(timeZone);
    return true;
  } catch {
    return false;
  }
}

export interface LocalParts {
  year: number; month: number; day: number; hour: number; minute: number; second: number;
}

/** Wall-clock parts of an instant in a zone. */
export function localParts(instant: Date, timeZone: string): LocalParts {
  const p: Record<string, number> = {};
  for (const x of fmt(timeZone).formatToParts(instant)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour!, minute: p.minute!, second: p.second! };
}

/** Offset (zone minus UTC) in milliseconds at an instant. */
export function offsetMs(instant: Date, timeZone: string): number {
  const p = localParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The UTC instant at which the wall clock in `timeZone` reads the given local date and time. */
export function zonedToUtc(year: number, month: number, day: number, minutesOfDay: number, timeZone: string): Date {
  const wall = Date.UTC(year, month - 1, day, 0, minutesOfDay, 0);
  // Offsets on either side of the wall time cover every transition within a day.
  const before = offsetMs(new Date(wall - 36 * 3600_000), timeZone);
  const after = offsetMs(new Date(wall + 36 * 3600_000), timeZone);
  const candidates = new Set<number>([wall - before, wall - after]);
  const valid: number[] = [];
  for (const c of candidates) {
    const back = localParts(new Date(c), timeZone);
    if (Date.UTC(back.year, back.month - 1, back.day, back.hour, back.minute, back.second) === wall) valid.push(c);
  }
  if (valid.length > 0) return new Date(Math.min(...valid)); // ambiguous -> first occurrence
  return new Date(wall - Math.min(before, after)); // gap -> shift forward using the earlier (pre-transition) offset
}

export function parseHm(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hm);
  if (!m) throw new Error(`invalid time of day: ${hm}`);
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi !== 0)) throw new Error(`invalid time of day: ${hm}`);
  return h * 60 + mi;
}

export interface YmdDate { year: number; month: number; day: number }

export function parseYmd(s: string): YmdDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new Error(`invalid date: ${s}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export const ymdKey = (d: YmdDate) => `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

/** ISO weekday of a calendar date: Monday = 1 ... Sunday = 7. */
export function isoWeekday(d: YmdDate): number {
  const w = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
  return w === 0 ? 7 : w;
}

export function addDays(d: YmdDate, n: number): YmdDate {
  const x = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() };
}

/** Calendar date (in `timeZone`) of an instant. */
export function localDate(instant: Date, timeZone: string): YmdDate {
  const p = localParts(instant, timeZone);
  return { year: p.year, month: p.month, day: p.day };
}
