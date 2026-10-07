import type { MatchingResult } from "./types";

/**
 * What-if comparison of two results for the same snapshot under different settings versions (settings preview, constants §0 rule 7).
 * Counts only; never exposes people beyond ids the PM already sees.
 */
export interface MatchingDiff {
  identical: boolean;
  seekersCompared: number;
  /** Seekers present in only one of the results. */
  seekersOnlyInA: string[];
  seekersOnlyInB: string[];
  /** Number of seekers whose ranked candidate list (membership or order) changed. */
  changedCandidateLists: number;
  /** Seekers whose top-N (N = the larger recommended list) changed, with before/after mentor ids. */
  top5Changes: { seekerId: string; before: string[]; after: string[] }[];
  /** Draft pair changes (both results must be drafts for this to be non-empty). */
  draftPairChanges: { seekerId: string; before: string | null; after: string | null }[];
  /** Pairs that became excluded / became eligible. */
  newlyExcludedPairs: number;
  newlyEligiblePairs: number;
}

const TOP_N = 5;

export function diffMatchingResults(a: MatchingResult, b: MatchingResult): MatchingDiff {
  const am = new Map(a.seekers.map((s) => [s.seekerId, s]));
  const bm = new Map(b.seekers.map((s) => [s.seekerId, s]));
  const onlyA = [...am.keys()].filter((k) => !bm.has(k)).sort();
  const onlyB = [...bm.keys()].filter((k) => !am.has(k)).sort();
  const common = [...am.keys()].filter((k) => bm.has(k)).sort();

  let changed = 0;
  let newlyExcluded = 0;
  let newlyEligible = 0;
  const top: MatchingDiff["top5Changes"] = [];
  for (const id of common) {
    const x = am.get(id)!;
    const y = bm.get(id)!;
    const xl = x.candidates.map((c) => c.mentorId);
    const yl = y.candidates.map((c) => c.mentorId);
    if (xl.length !== yl.length || xl.some((m, i) => m !== yl[i])) changed++;
    const xs = new Set(xl);
    const ys = new Set(yl);
    for (const m of xs) if (!ys.has(m)) newlyExcluded++;
    for (const m of ys) if (!xs.has(m)) newlyEligible++;
    const xt = xl.slice(0, TOP_N);
    const yt = yl.slice(0, TOP_N);
    if (xt.length !== yt.length || xt.some((m, i) => m !== yt[i])) top.push({ seekerId: id, before: xt, after: yt });
  }

  const draftChanges: MatchingDiff["draftPairChanges"] = [];
  if (a.draft || b.draft) {
    const pa = new Map((a.draft?.assignments ?? []).map((x) => [x.seekerId, x.mentorId]));
    const pb = new Map((b.draft?.assignments ?? []).map((x) => [x.seekerId, x.mentorId]));
    for (const id of [...new Set([...pa.keys(), ...pb.keys()])].sort()) {
      const before = pa.get(id) ?? null;
      const after = pb.get(id) ?? null;
      if (before !== after) draftChanges.push({ seekerId: id, before, after });
    }
  }

  return {
    identical: onlyA.length === 0 && onlyB.length === 0 && changed === 0 && top.length === 0 && draftChanges.length === 0 && newlyExcluded === 0 && newlyEligible === 0,
    seekersCompared: common.length,
    seekersOnlyInA: onlyA,
    seekersOnlyInB: onlyB,
    changedCandidateLists: changed,
    top5Changes: top,
    draftPairChanges: draftChanges,
    newlyExcludedPairs: newlyExcluded,
    newlyEligiblePairs: newlyEligible,
  };
}
