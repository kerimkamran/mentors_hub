/** Pure rubric logic (FR-VET-003, FR-VET-005, FR-VET-008): validation, scoring, averaging, advisory bands. */

export type AdvisoryOutcome = "approve" | "borderline" | "reject";
export const OUTCOMES: readonly AdvisoryOutcome[] = ["approve", "borderline", "reject"];

export interface RubricItem {
  code: string;
  label: string; // English fallback
  labelKey: string; // message key (en/az/ru)
  max: number;
}
export interface RubricSection {
  code: string;
  label: string;
  labelKey: string;
  items: RubricItem[];
}
/** A band applies from `min` (inclusive) up to the next band's `min`. Fractional averaged totals therefore always land in a band. */
export interface RubricBand {
  min: number;
  outcome: AdvisoryOutcome;
}
export interface RubricDefinition {
  sections: RubricSection[];
  bands: RubricBand[];
}

export type Scores = Record<string, number>;

export const allItems = (r: Pick<RubricDefinition, "sections">): RubricItem[] => r.sections.flatMap((s) => s.items);
export const maxTotal = (r: Pick<RubricDefinition, "sections">): number => allItems(r).reduce((a, i) => a + i.max, 0);

const CODE = /^[a-z][a-z0-9_]{0,30}$/;

/** Returns the list of problems (empty = valid). Used before a new rubric version is stored. */
export function validateRubric(r: RubricDefinition): string[] {
  const problems: string[] = [];
  if (!r.sections.length) problems.push("no sections");
  const sectionCodes = new Set<string>();
  const itemCodes = new Set<string>();
  for (const s of r.sections) {
    if (!CODE.test(s.code)) problems.push(`bad section code ${s.code}`);
    if (sectionCodes.has(s.code)) problems.push(`duplicate section ${s.code}`);
    sectionCodes.add(s.code);
    if (!s.items.length) problems.push(`section ${s.code} has no items`);
    for (const i of s.items) {
      if (!CODE.test(i.code)) problems.push(`bad item code ${i.code}`);
      if (itemCodes.has(i.code)) problems.push(`duplicate item ${i.code}`);
      itemCodes.add(i.code);
      if (!Number.isInteger(i.max) || i.max < 1 || i.max > 100) problems.push(`item ${i.code} max must be an integer 1-100`);
      if (!i.label.trim() || !i.labelKey.trim()) problems.push(`item ${i.code} needs a label`);
    }
  }
  const total = maxTotal(r);
  const b = r.bands;
  if (!b.length) problems.push("no bands");
  else {
    if (b[0]!.min !== 0) problems.push("the first band must start at 0");
    for (let k = 1; k < b.length; k++) if (!(b[k]!.min > b[k - 1]!.min)) problems.push("band starts must increase");
    if (b[b.length - 1]!.min > total) problems.push("a band starts above the maximum total");
    for (const x of b) if (!OUTCOMES.includes(x.outcome)) problems.push(`unknown outcome ${x.outcome}`);
  }
  return problems;
}

/** Advisory outcome for a (possibly fractional) total. Pure; the PM's decision is never constrained by it (FR-VET-003). */
export function bandFor(bands: RubricBand[], total: number): AdvisoryOutcome {
  let out: AdvisoryOutcome = bands[0]!.outcome;
  for (const b of bands) if (total >= b.min) out = b.outcome;
  return out;
}

/** Item codes that still lack a score, in rubric order. */
export function missingItems(r: Pick<RubricDefinition, "sections">, scores: Scores): string[] {
  return allItems(r).filter((i) => scores[i.code] === undefined).map((i) => i.code);
}

/** Rejects unknown items and out-of-range or non-integer scores. Returns the cleaned map or an error code. */
export function cleanScores(r: Pick<RubricDefinition, "sections">, raw: Record<string, unknown>): { ok: true; scores: Scores } | { ok: false; error: "unknown_item" | "bad_score"; item: string } {
  const byCode = new Map(allItems(r).map((i) => [i.code, i]));
  const scores: Scores = {};
  for (const [k, v] of Object.entries(raw)) {
    const item = byCode.get(k);
    if (!item) return { ok: false, error: "unknown_item", item: k };
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > item.max) return { ok: false, error: "bad_score", item: k };
    scores[k] = v;
  }
  return { ok: true, scores };
}

export const totalOf = (scores: Scores): number => Object.values(scores).reduce((a, b) => a + b, 0);

/** Item-wise mean over assessors, rounded to 2 decimals (FR-VET-005: scores are averaged). Every assessor must have scored every item. */
export function averageScores(all: Scores[]): Scores {
  if (!all.length) return {};
  const codes = Object.keys(all[0]!);
  const out: Scores = {};
  for (const c of codes) out[c] = Math.round((all.reduce((a, s) => a + (s[c] ?? 0), 0) / all.length) * 100) / 100;
  return out;
}

export const averageTotal = (all: Scores[]): number => Math.round((all.reduce((a, s) => a + totalOf(s), 0) / Math.max(1, all.length)) * 100) / 100;

/** The decision "differs from the advisory band" unless it matches approve/reject exactly; a borderline band always needs a reason (FR-VET-008). */
export function decisionDiffers(decision: "approved" | "rejected", band: AdvisoryOutcome): boolean {
  return !((decision === "approved" && band === "approve") || (decision === "rejected" && band === "reject"));
}

/** Reason is required when the decision differs; its length must reach the admin-managed minimum (C-152). */
export function reasonProblem(differs: boolean, reason: string | undefined | null, minLength: number): "required" | "too_short" | null {
  if (!differs) return null;
  const len = (reason ?? "").trim().length;
  if (len === 0) return "required";
  return len < Math.max(1, minLength) ? "too_short" : null;
}
