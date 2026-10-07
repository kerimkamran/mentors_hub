/**
 * Eligibility rules (FR-PRG-004). Pure: a rule set is an AND of rules over a few person facts. The same evaluator drives the live
 * "how many people are eligible" preview and the engine's ELIGIBILITY exclusion (C-083), so they can never disagree.
 */
import { normalise } from "../../lib/search";

export type EligibilityRule =
  | { type: "department_in"; departments: string[] }
  | { type: "tenure_min_months"; months: number }
  | { type: "grade_bucket_range"; min?: number; max?: number };

export interface PersonFacts {
  department: string | null;
  hireDate: Date | null;
  gradeBucket: number | null;
}

export type RuleProblem = { index: number; code: "type" | "departments" | "months" | "bucket" | "bucket_order" | "too_many" };
export const MAX_RULES = 10;
export const MAX_DEPARTMENTS = 50;

const fold = (s: string) => normalise(s.trim()); // same folding as search (ə/e, ı/i …)

export function validateRules(raw: unknown): { ok: true; rules: EligibilityRule[] } | { ok: false; problems: RuleProblem[] } {
  if (!Array.isArray(raw)) return { ok: false, problems: [{ index: 0, code: "type" }] };
  const problems: RuleProblem[] = [];
  const rules: EligibilityRule[] = [];
  if (raw.length > MAX_RULES) problems.push({ index: MAX_RULES, code: "too_many" });
  raw.slice(0, MAX_RULES).forEach((r: unknown, index) => {
    const o = (r ?? {}) as Record<string, unknown>;
    if (o.type === "department_in") {
      const d = o.departments;
      if (!Array.isArray(d) || d.length === 0 || d.length > MAX_DEPARTMENTS || d.some((x) => typeof x !== "string" || x.trim().length === 0 || x.length > 200)) problems.push({ index, code: "departments" });
      else rules.push({ type: "department_in", departments: [...new Set((d as string[]).map((x) => x.trim()))] });
    } else if (o.type === "tenure_min_months") {
      if (typeof o.months !== "number" || !Number.isInteger(o.months) || o.months < 1 || o.months > 600) problems.push({ index, code: "months" });
      else rules.push({ type: "tenure_min_months", months: o.months });
    } else if (o.type === "grade_bucket_range") {
      const { min, max } = o as { min?: unknown; max?: unknown };
      const okNum = (x: unknown) => x === undefined || (typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 50);
      if (!okNum(min) || !okNum(max) || (min === undefined && max === undefined)) problems.push({ index, code: "bucket" });
      else if (min !== undefined && max !== undefined && (min as number) > (max as number)) problems.push({ index, code: "bucket_order" });
      else rules.push({ type: "grade_bucket_range", ...(min !== undefined ? { min: min as number } : {}), ...(max !== undefined ? { max: max as number } : {}) });
    } else problems.push({ index, code: "type" });
  });
  return problems.length ? { ok: false, problems } : { ok: true, rules };
}

/** Whole months between two dates (calendar months, day-of-month aware). */
export function tenureMonths(hire: Date, asOf: Date): number {
  let m = (asOf.getUTCFullYear() - hire.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - hire.getUTCMonth());
  if (asOf.getUTCDate() < hire.getUTCDate()) m -= 1;
  return m;
}

/** Fail closed: a person whose needed fact is unknown does not satisfy a rule that needs it. */
export function isEligible(p: PersonFacts, rules: readonly EligibilityRule[], asOf: Date): boolean {
  return rules.every((r) => {
    switch (r.type) {
      case "department_in":
        return p.department !== null && r.departments.some((d) => fold(d) === fold(p.department!));
      case "tenure_min_months":
        return p.hireDate !== null && tenureMonths(p.hireDate, asOf) >= r.months;
      case "grade_bucket_range":
        return p.gradeBucket !== null && (r.min === undefined || p.gradeBucket >= r.min) && (r.max === undefined || p.gradeBucket <= r.max);
    }
  });
}
