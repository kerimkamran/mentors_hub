import { CRITERIA, type Criterion, type Labels, type MentorReasonCode, type ReasonCode } from "./types";
import type { MentorCtx, PairScore, ScoreEnv } from "./scoring";

/**
 * Explanations as reason codes (matching-spec §6). A reason is produced only from data the viewer may see, never contains
 * a score, percentage, weight, grade, reporting-line fact or exclusion, and at most `maxReasons` are returned.
 */

export interface RankedForExplain {
  mentor: MentorCtx;
  score: PairScore;
}

export function explainPool(env: ScoreEnv, pool: readonly RankedForExplain[]): { mentee: ReasonCode[]; mentor: MentorReasonCode[] }[] {
  const s = env.settings;
  const f = 10 ** s.scorePrecision;
  const thresholdUnits = Math.round(s.reasonThreshold * f); // compare in integer units, never floats
  const interestLabels = new Map(env.snap.interestCatalogue.map((i) => [i.id, i.labels]));
  const qualifies = (b: PairScore["breakdown"][number]) => b.weight > 0 && b.status === "scored" && Math.round(b.subscore * f) >= thresholdUnits;

  // Step 2: drop a reason that is true for ≥ C-060 of the scored pool.
  const dropped = new Set<Criterion>();
  for (const c of CRITERIA) {
    let n = 0;
    for (const r of pool) if (qualifies(r.score.breakdown.find((b) => b.criterion === c)!)) n++;
    if (pool.length > 0 && n > 0 && n >= s.commonReasonCutoff * pool.length - 1e-9) dropped.add(c);
  }

  return pool.map((r) => {
    const d = r.score.details;
    const v = r.mentor.mentor.visible;
    const candidates: { criterion: Criterion; units: number; code: ReasonCode }[] = [];
    for (const b of r.score.breakdown) {
      if (!qualifies(b) || dropped.has(b.criterion)) continue;
      const units = b.weight * Math.round(b.subscore * f);
      let code: ReasonCode | null = null;
      switch (b.criterion) {
        case "goal":
          if (v.topics && d.goal) code = { code: "GOAL_ALIGNMENT", topic: env.tax.label(d.goal.tag), goalPosition: d.goal.position };
          break;
        case "expertise":
          if (v.topics && d.expertise) code = { code: "EXPERTISE", topic: env.tax.label(d.expertise.tag), depth: d.expertise.depth };
          break;
        case "availability":
          if (v.availability && d.days !== null && d.days > 0) code = { code: "AVAILABILITY", days: d.days };
          break;
        case "career":
          // The reverse-mentoring band is never phrased to the mentee; no grade or reporting fact is ever named.
          if (d.band === "ahead" || d.band === "peer" || d.band === "far") code = { code: "CAREER", band: d.band };
          break;
        case "language":
          if (v.languages && d.sharedLanguages.length > 0) code = { code: "LANGUAGE", languages: [...d.sharedLanguages] };
          break;
        case "interests":
          if (v.interests && d.sharedInterests.length > 0) {
            const id = d.sharedInterests[0]!;
            code = { code: "INTERESTS", interest: interestLabels.get(id) ?? ({ en: id, az: id, ru: id } as Labels) };
          }
          break;
        case "other":
          if (v.questionnaire) code = { code: "COMPATIBILITY" };
          break;
      }
      if (code) candidates.push({ criterion: b.criterion, units, code });
    }
    // Step 3/4: weight × sub-score descending, ties by the fixed criterion order; keep the top `maxReasons`.
    candidates.sort((a, b) => b.units - a.units || CRITERIA.indexOf(a.criterion) - CRITERIA.indexOf(b.criterion));
    const mentee: ReasonCode[] = candidates.slice(0, s.maxReasons).map((c) => c.code);
    if (mentee.length === 0) mentee.push({ code: "GENERIC_FIT" }); // never an empty explanation

    const covered = [...d.covered].sort((a, b) => b.weight - a.weight || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0)).slice(0, s.maxReasons);
    const mentor: MentorReasonCode[] = covered.map((c) => (c.goalTitle ? { code: "MENTOR_SEEKS_TOPIC", topic: env.tax.label(c.tag), goalTitle: c.goalTitle } : { code: "MENTOR_SEEKS_TOPIC", topic: env.tax.label(c.tag) }));
    if (mentor.length === 0) mentor.push({ code: "MENTOR_GENERIC_FIT" });
    return { mentee, mentor };
  });
}
