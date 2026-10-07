import type { LadderEntry } from "./types";

/**
 * Grade ladder (FR-IMP-006). The ladder is derived from the grade labels found in the HR file:
 *   1. if every label is a number, they are ordered numerically;
 *   2. otherwise, if every label came with an explicit order value, that value decides;
 *   3. otherwise labels are ordered "naturally" (G2 before G10).
 * Positions are then divided into contiguous BUCKETS of near-equal size. Matching and the directory use the
 * bucket only; the raw label is never displayed to participants.
 */
export interface GradeInput {
  name: string;
  sourceOrder: number | null;
}

const NUMERIC = /^\d+(?:[.,]\d+)?$/;
const natural = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }) || (a < b ? -1 : a > b ? 1 : 0);

export function orderGrades(grades: GradeInput[]): GradeInput[] {
  const g = [...grades];
  if (g.length > 0 && g.every((x) => NUMERIC.test(x.name))) {
    const n = (x: GradeInput) => Number(x.name.replace(",", "."));
    return g.sort((a, b) => n(a) - n(b) || natural(a.name, b.name));
  }
  if (g.length > 0 && g.every((x) => x.sourceOrder !== null)) return g.sort((a, b) => a.sourceOrder! - b.sourceOrder! || natural(a.name, b.name));
  return g.sort((a, b) => natural(a.name, b.name));
}

/** Bucket (1-based) of position `index` among `count` ordered grades divided into at most `buckets` groups. */
export function bucketOf(index: number, count: number, buckets: number): number {
  const k = Math.max(1, Math.min(buckets, count));
  return 1 + Math.floor((index * k) / count);
}

/**
 * The ladder after an import: unchanged when no new label appears (stable and idempotent); otherwise re-derived over the
 * union of stored and new labels. Explicit orders already stored are kept when the file gives none.
 */
export function computeLadder(existing: LadderEntry[], fileGrades: GradeInput[], buckets: number): { ladder: LadderEntry[]; added: number; changed: number } {
  const known = new Map(existing.map((e) => [e.name, e]));
  const fresh = new Map<string, number | null>();
  for (const g of fileGrades) {
    if (known.has(g.name)) continue;
    const prior = fresh.get(g.name);
    fresh.set(g.name, prior === undefined ? g.sourceOrder : prior === null || g.sourceOrder === null ? (prior ?? g.sourceOrder) : Math.min(prior, g.sourceOrder));
  }
  if (fresh.size === 0) return { ladder: existing, added: 0, changed: 0 };
  const union: GradeInput[] = [
    ...existing.map((e) => ({ name: e.name, sourceOrder: e.sourceOrder })),
    ...[...fresh].map(([name, sourceOrder]) => ({ name, sourceOrder })),
  ];
  const ordered = orderGrades(union);
  const ladder = ordered.map((g, i): LadderEntry => ({ name: g.name, sourceOrder: g.sourceOrder, orderIndex: i, bucket: bucketOf(i, ordered.length, buckets) }));
  const changed = ladder.filter((l) => known.has(l.name) && known.get(l.name)!.bucket !== l.bucket).length;
  return { ladder, added: fresh.size, changed };
}
