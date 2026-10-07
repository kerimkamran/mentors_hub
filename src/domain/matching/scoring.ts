import { overlapDays, personGrid, teamGrid, type Horizon } from "./availability";
import {
  CRITERIA,
  type CareerBandName,
  type CriterionScore,
  type Depth,
  type Labels,
  type MatchingSettings,
  type MatchingSnapshot,
  type MemberInput,
  type MentorInput,
  type QuestionnaireQuestion,
  type SeekerGoal,
  type SeekerInput,
  type SubScoreStatus,
  type TagId,
} from "./types";

/** Round half up to `p` decimals (scores are non-negative). */
export function roundTo(x: number, p: number): number {
  const f = 10 ** p;
  return Math.round(x * f + 1e-9) / f;
}

const DEPTH_RANK: Record<Depth, number> = { working: 0, advanced: 1, expert: 2 };

/* ------------------------------------------------------------------------------------------ */
/* Taxonomy                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export class TaxIndex {
  private readonly canonOf = new Map<string, string>();
  private readonly parentOf = new Map<string, string | null>();
  private readonly childrenOf = new Map<string, string[]>();
  private readonly labelOf = new Map<string, Labels>();

  constructor(snap: MatchingSnapshot) {
    const byId = new Map(snap.taxonomy.map((t) => [t.id, t]));
    const resolve = (id: string): string => {
      let cur = id;
      for (let i = 0; i < 8; i++) {
        const next = byId.get(cur)?.canonicalId;
        if (!next || next === cur) return cur;
        cur = next;
      }
      return cur;
    };
    for (const t of snap.taxonomy) {
      const c = resolve(t.id);
      this.canonOf.set(t.id, c);
      if (c === t.id) {
        this.labelOf.set(t.id, t.labels);
        const p = t.parentId ? resolve(t.parentId) : null;
        this.parentOf.set(t.id, p && p !== t.id ? p : null);
      }
    }
    for (const [id, p] of this.parentOf) {
      if (p === null) continue;
      const list = this.childrenOf.get(p) ?? [];
      list.push(id);
      this.childrenOf.set(p, list);
    }
    for (const l of this.childrenOf.values()) l.sort();
  }
  canon(id: TagId): string {
    return this.canonOf.get(id) ?? id;
  }
  parent(canonId: string): string | null {
    return this.parentOf.get(canonId) ?? null;
  }
  children(canonId: string): readonly string[] {
    return this.childrenOf.get(canonId) ?? [];
  }
  label(id: TagId): Labels {
    return this.labelOf.get(this.canon(id)) ?? { en: id, az: id, ru: id };
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Contexts                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export interface GoalGroup {
  goal: Pick<SeekerGoal, "id" | "primary" | "sharedTitle">;
  position: "first" | "other" | "team";
  tags: string[]; // canonical, unique, sorted
  weight: number;
}

export interface SeekerCtx {
  seeker: SeekerInput;
  lead: MemberInput;
  goalGroups: GoalGroup[];
  /** N: the topics the seeker is seeking (canonical, sorted). */
  needed: string[];
  grid: Uint8Array | null;
}

export interface MentorCtx {
  mentor: MentorInput;
  tags: Map<string, Depth>; // canonical → deepest declared depth
  grid: Uint8Array | null;
}

export interface ScoreEnv {
  settings: MatchingSettings;
  snap: MatchingSnapshot;
  tax: TaxIndex;
  horizon: Horizon | null;
  questions: readonly QuestionnaireQuestion[];
}

export function buildSeekerCtx(env: ScoreEnv, seeker: SeekerInput): SeekerCtx {
  const { settings: s, tax } = env;
  const lead = seeker.members.find((m) => m.personId === seeker.leadPersonId)!;
  const groups: GoalGroup[] = [];
  const needed = new Set<string>();
  if (seeker.kind === "team") {
    const tags = [...new Set(seeker.neededExpertise.map((t) => tax.canon(t)))].sort();
    if (tags.length) groups.push({ goal: { id: "team", primary: false, sharedTitle: null }, position: "team", tags, weight: 1 });
    tags.forEach((t) => needed.add(t));
  } else {
    let idx = 0;
    for (const g of seeker.goals) {
      const tags = [...new Set(g.tags.map((t) => tax.canon(t)))].sort();
      tags.forEach((t) => needed.add(t));
      if (tags.length === 0) continue;
      groups.push({ goal: g, position: idx === 0 ? "first" : "other", tags, weight: g.primary ? s.primaryGoalMultiplier : 1 });
      idx++;
    }
  }
  let grid: Uint8Array | null = null;
  if (env.horizon) {
    if (seeker.kind === "team") {
      const grids = seeker.members.map((m) => personGrid(m.availability, env.horizon!));
      const leadGrid = grids[seeker.members.indexOf(lead)]!;
      grid = lead.availability && lead.availability.length > 0 ? teamGrid(grids, leadGrid, s.teamQuorum) : null;
    } else {
      grid = lead.availability && lead.availability.length > 0 ? personGrid(lead.availability, env.horizon) : null;
    }
  }
  return { seeker, lead, goalGroups: groups, needed: [...needed].sort(), grid };
}

export function buildMentorCtx(env: ScoreEnv, mentor: MentorInput): MentorCtx {
  const tags = new Map<string, Depth>();
  for (const t of mentor.topics) {
    const c = env.tax.canon(t.tagId);
    const prev = tags.get(c);
    if (prev === undefined || DEPTH_RANK[t.depth] > DEPTH_RANK[prev]) tags.set(c, t.depth);
  }
  const grid = env.horizon && mentor.availability && mentor.availability.length > 0 ? personGrid(mentor.availability, env.horizon) : null;
  return { mentor, tags, grid };
}

/** Days per week with a slot suitable for both sides, or null if either side has not provided availability. */
export function pairOverlapDays(env: ScoreEnv, sc: SeekerCtx, mc: MentorCtx): number | null {
  if (!env.horizon || !sc.grid || !mc.grid) return null;
  return overlapDays(sc.grid, mc.grid, env.horizon);
}

/* ------------------------------------------------------------------------------------------ */
/* Per-criterion scoring                                                                       */
/* ------------------------------------------------------------------------------------------ */

interface Cover {
  cov: number;
  depth: Depth | null;
  /** The mentor's own tag that covers the sought tag. */
  via: string | null;
}

/** Coverage of one sought tag by the mentor's topics (matching-spec §4.1): 1.0 exact, partial credit via parent or a child, else 0. */
function cover(env: ScoreEnv, mc: MentorCtx, n: string): Cover {
  const exact = mc.tags.get(n);
  if (exact !== undefined) return { cov: 1, depth: exact, via: n };
  const credit = env.settings.taxonomyPartialCredit;
  let best: { tag: string; depth: Depth } | null = null;
  for (const rel of [env.tax.parent(n), ...env.tax.children(n)]) {
    if (rel === null) continue;
    const d = mc.tags.get(rel);
    if (d === undefined) continue;
    if (best === null || DEPTH_RANK[d] > DEPTH_RANK[best.depth] || (DEPTH_RANK[d] === DEPTH_RANK[best.depth] && rel < best.tag)) best = { tag: rel, depth: d };
  }
  if (best === null || credit <= 0) return { cov: 0, depth: null, via: null };
  return { cov: credit, depth: best.depth, via: best.tag };
}

export interface ScoreDetails {
  goal: { tag: string; position: GoalGroup["position"] } | null;
  expertise: { tag: string; depth: Depth } | null;
  /** Seeker-sought topics the mentor covers (cov>0) with the group they came from — for the mentor view. */
  covered: { tag: string; weight: number; goalTitle: string | null }[];
  days: number | null;
  band: CareerBandName | null;
  sharedLanguages: string[];
  sharedInterests: string[];
}

export interface PairScore {
  breakdown: CriterionScore[];
  /** Σ weight × sub-score, in 10^-precision units (an exact integer). */
  totalUnits: number;
  details: ScoreDetails;
}

interface Raw {
  value: number;
  status: SubScoreStatus;
}

export function scorePair(env: ScoreEnv, sc: SeekerCtx, mc: MentorCtx, days: number | null): PairScore {
  const { settings: s } = env;
  const p = s.scorePrecision;
  const f = 10 ** p;
  const details: ScoreDetails = { goal: null, expertise: null, covered: [], days: null, band: null, sharedLanguages: [], sharedInterests: [] };
  const neutral = (): Raw => ({ value: s.neutralScore, status: "neutral_seeker_missing" });
  const mentorMissing = (): Raw => ({ value: s.missingMentorScore, status: "mentor_missing" });
  const scored = (v: number): Raw => ({ value: Math.min(1, Math.max(0, v)), status: "scored" });

  const raw: Record<(typeof CRITERIA)[number], Raw | null> = { goal: null, expertise: null, availability: null, career: null, language: null, interests: null, other: null };

  /* 4.1 / 4.2 coverage is shared between goal and expertise. */
  const needsTopics = s.weights.goal > 0 || s.weights.expertise > 0;
  const coverage = new Map<string, Cover>();
  if (needsTopics && mc.tags.size > 0) for (const n of sc.needed) coverage.set(n, cover(env, mc, n));

  if (s.weights.goal > 0) {
    if (mc.tags.size === 0) raw.goal = mentorMissing();
    else if (sc.goalGroups.length === 0) raw.goal = neutral();
    else {
      let num = 0;
      let den = 0;
      let best: { score: number; tag: string; position: GoalGroup["position"] } | null = null;
      for (const g of sc.goalGroups) {
        const cg = g.tags.reduce((a, t) => a + coverage.get(t)!.cov, 0) / g.tags.length;
        num += g.weight * cg;
        den += g.weight;
        if (cg > 0) {
          const sc2 = g.weight * cg;
          if (best === null || sc2 > best.score) {
            // Name the mentor's own tag that covers the group's best-covered sought tag.
            let bt = "";
            let bc = -1;
            for (const t of g.tags) {
              const c = coverage.get(t)!;
              if (c.cov > bc && c.via !== null) {
                bc = c.cov;
                bt = c.via;
              }
            }
            best = { score: sc2, tag: bt, position: g.position };
          }
        }
      }
      raw.goal = scored(num / den);
      if (best) details.goal = { tag: best.tag, position: best.position };
    }
  }

  if (s.weights.expertise > 0) {
    if (mc.tags.size === 0) raw.expertise = mentorMissing();
    else if (sc.needed.length === 0) raw.expertise = neutral();
    else {
      let sum = 0;
      let bestTag: { v: number; tag: string; depth: Depth } | null = null;
      for (const n of sc.needed) {
        const c = coverage.get(n)!;
        const v = c.depth === null ? 0 : c.cov * s.depthFactors[c.depth];
        sum += v;
        if (v > 0 && c.via !== null && c.depth !== null && (bestTag === null || v > bestTag.v)) bestTag = { v, tag: c.via, depth: c.depth };
      }
      let v = sum / sc.needed.length;
      if (sc.seeker.kind === "team" && sc.seeker.phase !== null) v *= mc.mentor.phases.includes(sc.seeker.phase) ? 1 : s.phaseMismatchMultiplier;
      raw.expertise = scored(v);
      if (bestTag) details.expertise = { tag: bestTag.tag, depth: bestTag.depth };
    }
  }
  if (needsTopics)
    for (const n of sc.needed) {
      const c = coverage.get(n);
      if (c && c.cov > 0 && c.depth !== null) {
        const g = sc.goalGroups.find((x) => x.tags.includes(n) && x.goal.sharedTitle);
        details.covered.push({ tag: n, weight: c.cov * s.depthFactors[c.depth], goalTitle: g?.goal.sharedTitle ?? null });
      }
    }

  /* 4.3 availability */
  if (s.weights.availability > 0) {
    const mentorHas = !!mc.mentor.availability && mc.mentor.availability.length > 0;
    const seekerHas = !!sc.lead.availability && sc.lead.availability.length > 0;
    if (!mentorHas) raw.availability = mentorMissing();
    else if (!seekerHas) raw.availability = neutral();
    else {
      const d = days ?? 0;
      details.days = d;
      raw.availability = scored(Math.min(d, s.availabilitySaturationDays) / s.availabilitySaturationDays);
    }
  }

  /* 4.4 career level */
  if (s.weights.career > 0) {
    const mb = mc.mentor.gradeBucket;
    const sb = sc.lead.gradeBucket;
    if (mb === null) raw.career = mentorMissing();
    else if (sb === null) raw.career = neutral();
    else {
      const gap = mb - sb;
      const band = s.careerBands.find((b) => (b.minGap === null || gap >= b.minGap) && (b.maxGap === null || gap <= b.maxGap));
      details.band = band?.band ?? null;
      raw.career = scored(band?.score ?? 0);
    }
  }

  /* 4.5 language */
  if (s.weights.language > 0) {
    const ml = mc.mentor.languages;
    const sl = sc.lead.languages;
    if (!ml || ml.length === 0) raw.language = mentorMissing();
    else if (!sl || sl.length === 0) raw.language = neutral();
    else {
      const mm = new Map(ml.map((x) => [x.language, x.level]));
      let best = 0;
      const shared: string[] = [];
      for (const x of sl) {
        const lv = mm.get(x.language);
        if (lv === undefined) continue;
        shared.push(x.language);
        const weaker = lv === "fluent" && x.level === "fluent" ? "fluent" : "working";
        best = Math.max(best, s.languageScores[weaker]);
      }
      details.sharedLanguages = shared.sort();
      raw.language = scored(best);
    }
  }

  /* 4.6 interests (Jaccard) */
  if (s.weights.interests > 0) {
    const mi = mc.mentor.interests;
    const si = sc.lead.interests;
    if (!mi || mi.length === 0) raw.interests = mentorMissing();
    else if (!si || si.length === 0) raw.interests = neutral();
    else {
      const a = new Set(si);
      const inter = mi.filter((x) => a.has(x));
      const union = new Set([...si, ...mi]).size;
      details.sharedInterests = [...inter].sort();
      raw.interests = scored(inter.length / union);
    }
  }

  /* 4.7 other (compatibility questionnaire) */
  if (s.weights.other > 0) raw.other = scoreCompat(env, s, sc, mc, neutral, mentorMissing, scored);

  const breakdown: CriterionScore[] = CRITERIA.map((c) => {
    const w = s.weights[c];
    const r = raw[c];
    if (w === 0 || r === null) return { criterion: c, weight: w, subscore: 0, contribution: 0, status: "unweighted" as const };
    const sub = roundTo(r.value, p);
    return { criterion: c, weight: w, subscore: sub, contribution: (w * Math.round(sub * f)) / f, status: r.status };
  });
  const totalUnits = breakdown.reduce((a, b) => a + b.weight * Math.round(b.subscore * f), 0);
  return { breakdown, totalUnits, details };
}

function scoreCompat(
  env: ScoreEnv,
  _s: MatchingSettings,
  sc: SeekerCtx,
  mc: MentorCtx,
  neutral: () => Raw,
  mentorMissing: () => Raw,
  scored: (v: number) => Raw,
): Raw {
  const qs = env.questions;
  if (qs.length === 0) return neutral(); // Open without the optional questions: "missing → neutral" for everyone (§4.7)
  const ma = mc.mentor.compat;
  const sa = sc.lead.compat;
  if (!ma || ma.length === 0) return mentorMissing();
  if (!sa || sa.length === 0) return neutral();
  const mm = new Map(ma.map((a) => [a.questionId, a.value]));
  const sm = new Map(sa.map((a) => [a.questionId, a.value]));
  const sections = new Map<string, number[]>();
  for (const q of qs) {
    const a = sm.get(q.id);
    const b = mm.get(q.id);
    if (a === undefined || b === undefined) continue;
    const range = q.scaleMax - q.scaleMin;
    const diff = Math.min(1, Math.abs(a - b) / range);
    const v = q.mode === "similar" ? 1 - diff : diff;
    const list = sections.get(q.section) ?? [];
    list.push(v);
    sections.set(q.section, list);
  }
  if (sections.size === 0) return neutral(); // no common question to compare
  const means = [...sections.keys()].sort().map((k) => {
    const l = sections.get(k)!;
    return l.reduce((x, y) => x + y, 0) / l.length;
  });
  return scored(means.reduce((x, y) => x + y, 0) / means.length);
}
