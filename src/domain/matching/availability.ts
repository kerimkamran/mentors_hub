import type { AvailabilityRule, IsoDate } from "./types";

/** Calendar maths on ISO dates without touching a clock or a time zone. */
export function dayNumber(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Monday = 1 … Sunday = 7. Day 0 (1970-01-01) was a Thursday. */
export function weekdayOfDay(day: number): number {
  return ((((day + 3) % 7) + 7) % 7) + 1;
}

export interface Horizon {
  startDay: number;
  days: number;
  slotMinutes: number;
  cellsPerDay: number;
  /** Weekday (1–7) of each day of the horizon. */
  weekdays: Uint8Array;
}

/** The generated slot grid: `weeks` weeks from `as_of` (C-150), cells of `slotMinutes`. */
export function buildHorizon(asOf: IsoDate, weeks: number, slotMinutes: number): Horizon {
  const startDay = dayNumber(asOf);
  const days = weeks * 7;
  const weekdays = new Uint8Array(days);
  for (let i = 0; i < days; i++) weekdays[i] = weekdayOfDay(startDay + i);
  return { startDay, days, slotMinutes, cellsPerDay: Math.floor(1440 / slotMinutes), weekdays };
}

/** Free cells of one person over the horizon (1 = the whole cell lies inside a rule valid on that date). */
export function personGrid(rules: readonly AvailabilityRule[] | null, h: Horizon): Uint8Array {
  const grid = new Uint8Array(h.days * h.cellsPerDay);
  if (!rules) return grid;
  const parsed = rules.map((r) => ({
    weekday: r.weekday,
    k0: Math.ceil(r.startMinute / h.slotMinutes),
    k1: Math.floor(r.endMinute / h.slotMinutes),
    from: r.validFrom === null ? -Infinity : dayNumber(r.validFrom),
    to: r.validTo === null ? Infinity : dayNumber(r.validTo),
  }));
  for (let d = 0; d < h.days; d++) {
    const day = h.startDay + d;
    const wd = h.weekdays[d]!;
    for (const r of parsed) {
      if (r.weekday !== wd || day < r.from || day > r.to) continue;
      for (let k = r.k0; k < r.k1; k++) grid[d * h.cellsPerDay + k] = 1;
    }
  }
  return grid;
}

/**
 * Team grid (C-027): a cell counts only if the team lead AND at least `quorum` of all members (lead included) are free.
 * Integer arithmetic avoids floating-point drift at the quorum boundary (e.g. 3 of 5 = 60%).
 */
export function teamGrid(memberGrids: readonly Uint8Array[], leadGrid: Uint8Array, quorum: number): Uint8Array {
  const out = new Uint8Array(leadGrid.length);
  const need = Math.round(quorum * 1000);
  const n = memberGrids.length;
  for (let i = 0; i < out.length; i++) {
    if (!leadGrid[i]) continue;
    let free = 0;
    for (const g of memberGrids) free += g[i]!;
    if (free * 1000 >= need * n) out[i] = 1;
  }
  return out;
}

/** Number of distinct weekdays (per week) with at least one cell free for both sides within the horizon (matching-spec §4.3). */
export function overlapDays(a: Uint8Array, b: Uint8Array, h: Horizon): number {
  const found = new Uint8Array(8);
  let count = 0;
  for (let d = 0; d < h.days && count < 7; d++) {
    const wd = h.weekdays[d]!;
    if (found[wd]) continue;
    const base = d * h.cellsPerDay;
    for (let k = 0; k < h.cellsPerDay; k++) {
      if (a[base + k] && b[base + k]) {
        found[wd] = 1;
        count++;
        break;
      }
    }
  }
  return count;
}
