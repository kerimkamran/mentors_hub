/**
 * The settings registry: for every group, its fields with bounds (constants §0), starting defaults and cross-field rules.
 * PURE (no database). The one place bounds live; the form builder, the save path, import, restore and the tests all use it.
 * Messages are keys + params (Problem), translated at the edge: nothing stored or audited is free text.
 */
import {
  ADMIN_OPS_DEFAULTS, BOUNDS, BRAND_DEFAULTS, CADENCE_DAYS, CAPACITY_DEFAULT, CAPACITY_MAX_DEFAULT, EXCLUSION_DEFAULTS, FIXED,
  LOCKED_EXCLUSIONS, MATCHING_FACTOR_DEFAULTS, SESSION_TIMING_DEFAULTS, SWITCHABLE_EXCLUSIONS, TIMING_DEFAULTS, WEIGHTS, WEIGHT_KEYS,
  type ProgrammeType,
} from "../../lib/constants-programmes";
import { DEFAULTS } from "../../lib/constants";
import { BRAND_TOKENS, HEX, contrastFailures, type BrandTokens } from "./contrast";
import type { GroupId, Problem, ScopeKind, Values } from "./types";

export type FieldKind = "int" | "number" | "bool" | "enum" | "hex" | "uuid" | "tz";
export type Unit = "days" | "hours" | "minutes" | "weeks" | "chars" | "percent" | "score" | "count" | "gap";
export type Tab = "general" | "matching" | "timings" | "flags" | "security" | "session" | "ops" | "brand" | "localisation";

export interface FieldSpec {
  path: string;
  kind: FieldKind;
  min?: number;
  max?: number;
  /** Open lower bound: the value must be strictly greater than `min` (factors in (0, 1]). */
  minExclusive?: boolean;
  options?: readonly string[];
  /** A boolean that must be true (the three "never" exclusions). */
  locked?: boolean;
  nullable?: boolean;
  unit?: Unit;
  constant?: string; // C-nnn the starting default comes from
  tab: Tab;
  /** UI section heading key suffix. */
  section?: string;
}

const int = (path: string, b: { min: number; max: number }, tab: Tab, more: Partial<FieldSpec> = {}): FieldSpec => ({ path, kind: "int", min: b.min, max: b.max, tab, ...more });
const num = (path: string, b: { min: number; max: number }, tab: Tab, more: Partial<FieldSpec> = {}): FieldSpec => ({ path, kind: "number", min: b.min, max: b.max, tab, ...more });
const bool = (path: string, tab: Tab, more: Partial<FieldSpec> = {}): FieldSpec => ({ path, kind: "bool", tab, ...more });
const hex = (path: string): FieldSpec => ({ path, kind: "hex", tab: "brand" });

const unitFactor = (path: string, section: string): FieldSpec => num(path, BOUNDS.depthFactor, "matching", { minExclusive: true, unit: "score", section });
const unitScore = (path: string, section: string, constant?: string): FieldSpec => num(path, BOUNDS.unit, "matching", { unit: "score", section, constant });

const MATCHING_FIELDS: FieldSpec[] = [
  unitFactor("depthFactors.working", "factors"),
  unitFactor("depthFactors.advanced", "factors"),
  unitFactor("depthFactors.expert", "factors"),
  int("primaryGoalMultiplier", BOUNDS.primaryGoalMultiplier, "matching", { section: "factors", constant: "C-051" }),
  unitScore("parentChildCredit", "factors", "C-052"),
  int("availabilitySaturationDays", BOUNDS.availabilitySaturationDays, "matching", { section: "subscores", unit: "days", constant: "C-053" }),
  unitScore("careerBands.ahead", "subscores", "C-054"),
  unitScore("careerBands.peer", "subscores", "C-054"),
  unitScore("careerBands.far", "subscores", "C-054"),
  unitScore("careerBands.mentorJunior", "subscores", "C-054"),
  int("careerGaps.peerMin", BOUNDS.gap, "matching", { section: "subscores", unit: "gap", constant: "C-055" }),
  int("careerGaps.peerMax", BOUNDS.gap, "matching", { section: "subscores", unit: "gap", constant: "C-055" }),
  int("careerGaps.aheadMin", BOUNDS.gap, "matching", { section: "subscores", unit: "gap", constant: "C-055" }),
  int("careerGaps.aheadMax", BOUNDS.gap, "matching", { section: "subscores", unit: "gap", constant: "C-055" }),
  int("careerGaps.farMin", BOUNDS.gap, "matching", { section: "subscores", unit: "gap", constant: "C-055" }),
  unitScore("languageScores.fluent", "subscores", "C-056"),
  unitScore("languageScores.working", "subscores", "C-056"),
  unitScore("neutralScore", "thresholds", "C-057"),
  num("reasonThreshold", BOUNDS.depthFactor, "matching", { minExclusive: true, unit: "score", section: "thresholds", constant: "C-059" }),
  num("commonReasonCutoff", BOUNDS.depthFactor, "matching", { minExclusive: true, unit: "score", section: "thresholds", constant: "C-060" }),
  ...WEIGHT_KEYS.map((k) => int(`weights.${k}`, { min: 0, max: 100 }, "matching", { section: "weights", unit: "count", constant: "C-070" })),
  ...LOCKED_EXCLUSIONS.map((k) => bool(`exclusions.${k}`, "matching", { section: "exclusions", locked: true, constant: k === "samePerson" ? "C-080" : k === "blocked" ? "C-081" : "C-082" })),
  ...SWITCHABLE_EXCLUSIONS.map((k, i) => bool(`exclusions.${k}`, "matching", { section: "exclusions", constant: `C-0${83 + i}` })),
  int("availabilityHorizonWeeks", BOUNDS.horizonWeeks, "timings", { section: "horizon", unit: "weeks", constant: "C-150" }),
];

const ORG_FLAG_KEYS = ["aiEnabled", "smartGoalAssistant", "agendaAssistant", "aiTranslation", "attachments", "openMentoring"] as const;
const PROGRAMME_FLAG_KEYS = ["aiEnabled", "attachments", "openReports"] as const;
export type Prerequisite = "dpia_signoff" | "storage_approval";
/** Which recorded approval a flag needs before it can be switched on (AC-PRG-05.2). */
export const FLAG_PREREQUISITE: Record<ScopeKind, Record<string, Prerequisite | undefined>> = {
  organisation: { aiEnabled: "dpia_signoff", smartGoalAssistant: "dpia_signoff", agendaAssistant: "dpia_signoff", aiTranslation: "dpia_signoff", attachments: "storage_approval" },
  programme: { aiEnabled: "dpia_signoff", attachments: "storage_approval" },
};
export const FLAG_KEYS: Record<ScopeKind, readonly string[]> = { organisation: ORG_FLAG_KEYS, programme: PROGRAMME_FLAG_KEYS };

const FIELDS: Record<ScopeKind, Partial<Record<GroupId, FieldSpec[]>>> = {
  programme: {
    cadence_capacity: [
      int("cadenceDays", BOUNDS.cadenceDays, "general", { unit: "days", constant: "C-020" }),
      int("capacityDefault", BOUNDS.capacityDefault, "general", { unit: "count", constant: "C-021" }),
      int("capacityMax", BOUNDS.capacityMax, "general", { unit: "count", constant: "C-021" }),
    ],
    matching: MATCHING_FIELDS,
    timings: [
      int("openRequestReminderDays", { min: 1, max: FIXED.openRequestExpiryDays - 1 }, "timings", { unit: "days", constant: "C-003" }),
      int("assessmentReminderLeadDays", BOUNDS.reminderLeadDays, "timings", { unit: "days", constant: "C-153" }),
      int("proposalReminderLeadDays", { min: 1, max: FIXED.proposalWindowDays - 1 }, "timings", { unit: "days", constant: "C-154" }),
      int("reportReminderLeadDays", BOUNDS.reminderLeadDays, "timings", { unit: "days", constant: "C-157" }),
      int("wrapUpNudgeHours", BOUNDS.wrapUpNudgeHours, "timings", { unit: "hours", constant: "C-155" }),
      int("noGoalNudgeDays", { min: 1, max: FIXED.acceptedNoSessionDays - 1 }, "timings", { unit: "days", constant: "C-156" }),
      int("reapplyCoolOffDays", BOUNDS.coolOffDays, "timings", { unit: "days", constant: "C-151" }),
      int("minReasonLength", BOUNDS.minReasonLength, "timings", { unit: "chars", constant: "C-152" }),
    ],
    flags: PROGRAMME_FLAG_KEYS.map((k) => bool(k, "flags")),
  },
  organisation: {
    security: [
      int("linkLifetimeMinutes", BOUNDS.linkLifetimeMinutes, "security", { unit: "minutes", constant: "C-041" }),
      int("codeAttempts", BOUNDS.codeAttempts, "security", { unit: "count", constant: "C-042" }),
      int("sessionIdleMinutes", BOUNDS.sessionIdleMinutes, "security", { unit: "minutes", constant: "C-043" }),
      int("sessionAbsoluteDays", BOUNDS.sessionAbsoluteDays, "security", { unit: "days", constant: "C-043" }),
      int("rateWindowMinutes", BOUNDS.rateWindowMinutes, "security", { unit: "minutes", constant: "C-046" }),
      int("rateRequestsPerEmail", BOUNDS.rateRequestsPerEmail, "security", { unit: "count", constant: "C-046" }),
      int("rateRequestsPerBrowser", BOUNDS.rateRequestsPerBrowser, "security", { unit: "count", constant: "C-046" }),
    ],
    session_timing: [
      int("noShowGraceMinutes", BOUNDS.noShowGraceMinutes, "session", { unit: "minutes", constant: "C-158" }),
      int("aboutToStartMinutes", BOUNDS.aboutToStartMinutes, "session", { unit: "minutes", constant: "C-159" }),
    ],
    admin_ops: [
      int("approvalLifetimeDays", BOUNDS.approvalLifetimeDays, "ops", { unit: "days", constant: "C-160" }),
      int("announcementMaxLength", BOUNDS.announcementMaxLength, "ops", { unit: "chars", constant: "C-164" }),
      int("bounceThresholdPercent", BOUNDS.bounceThresholdPercent, "ops", { unit: "percent", constant: "C-165" }),
      int("bounceMinSends", BOUNDS.bounceMinSends, "ops", { unit: "count", constant: "C-165" }),
      int("responseTargetDays", BOUNDS.responseTargetDays, "ops", { unit: "days", constant: "C-166" }),
      int("dueSoonLeadDays", BOUNDS.dueSoonLeadDays, "ops", { unit: "days", constant: "C-167" }),
    ],
    flags: ORG_FLAG_KEYS.map((k) => bool(k, "flags")),
    brand: [{ path: "logoId", kind: "uuid", nullable: true, tab: "brand" }, ...BRAND_TOKENS.map(hex)],
    localisation: [
      { path: "defaultLocale", kind: "enum", options: ["en", "az", "ru"], tab: "localisation" },
      { path: "timeZone", kind: "tz", tab: "localisation" },
    ],
  },
};

export function fieldsOf(group: GroupId, kind: ScopeKind): FieldSpec[] {
  const f = FIELDS[kind][group];
  if (!f) throw new Error(`group ${group} does not exist at ${kind} scope`);
  return f;
}
export const groupAllowed = (group: GroupId, kind: ScopeKind): boolean => !!FIELDS[kind][group];

/** The tab a field is shown on may differ from its group's main tab (the availability horizon is a Timings field). */
export function fieldsForTab(kind: ScopeKind, tab: Tab): { group: GroupId; spec: FieldSpec }[] {
  return (Object.keys(FIELDS[kind]) as GroupId[]).flatMap((group) => fieldsOf(group, kind).filter((s) => s.tab === tab).map((spec) => ({ group, spec })));
}

// ------------------------------------------------------------------ values: get / set / flatten
export function getPath(v: unknown, path: string): unknown {
  let cur: unknown = v;
  for (const k of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
export function setPath(v: Values, path: string, value: unknown): void {
  const keys = path.split(".");
  let cur = v;
  for (const k of keys.slice(0, -1)) {
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k] as Values;
  }
  cur[keys[keys.length - 1]!] = value;
}
export function flatten(v: unknown, prefix = ""): Record<string, unknown> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return prefix ? { [prefix]: v } : {};
  return Object.entries(v as Values).reduce<Record<string, unknown>>((acc, [k, x]) => Object.assign(acc, flatten(x, prefix ? `${prefix}.${k}` : k)), {});
}
export function unflatten(flat: Record<string, unknown>): Values {
  const out: Values = {};
  for (const [p, x] of Object.entries(flat)) setPath(out, p, x);
  return out;
}
/** Deep merge of plain objects; arrays and primitives replace. */
export function deepMerge(base: Values, patch: Values): Values {
  const out: Values = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v !== null && typeof v === "object" && !Array.isArray(v) && typeof base[k] === "object" && base[k] !== null ? deepMerge(base[k] as Values, v as Values) : v;
  }
  return out;
}

// ------------------------------------------------------------------ defaults
export function defaultValues(group: GroupId, kind: ScopeKind, type: ProgrammeType = "leadership"): Values {
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  if (kind === "programme") {
    switch (group) {
      case "cadence_capacity": return { cadenceDays: CADENCE_DAYS[type], capacityDefault: CAPACITY_DEFAULT[type], capacityMax: CAPACITY_MAX_DEFAULT };
      case "matching": return clone({ ...MATCHING_FACTOR_DEFAULTS, weights: WEIGHTS[type], exclusions: { samePerson: true, blocked: true, notApproved: true, ...EXCLUSION_DEFAULTS[type] } });
      case "timings": return clone({ ...TIMING_DEFAULTS });
      case "flags": return { aiEnabled: false, attachments: false, openReports: false };
      default: break;
    }
  } else {
    switch (group) {
      case "security":
        return {
          linkLifetimeMinutes: DEFAULTS.linkLifetimeMinutes, codeAttempts: DEFAULTS.codeAttempts, sessionIdleMinutes: DEFAULTS.sessionIdleMinutes,
          sessionAbsoluteDays: DEFAULTS.sessionAbsoluteDays, rateWindowMinutes: DEFAULTS.rateWindowMinutes,
          rateRequestsPerEmail: DEFAULTS.rateRequestsPerEmail, rateRequestsPerBrowser: DEFAULTS.rateRequestsPerBrowser,
        };
      case "session_timing": return clone({ ...SESSION_TIMING_DEFAULTS });
      case "admin_ops": return clone({ ...ADMIN_OPS_DEFAULTS });
      case "flags": return { aiEnabled: false, smartGoalAssistant: false, agendaAssistant: false, aiTranslation: false, attachments: false, openMentoring: false };
      case "brand": return { logoId: null, ...BRAND_DEFAULTS };
      case "localisation": return { defaultLocale: "en", timeZone: DEFAULTS.defaultTimeZone };
      default: break;
    }
  }
  throw new Error(`group ${group} does not exist at ${kind} scope`);
}

// ------------------------------------------------------------------ validation
const validTimeZone = (tz: string) => {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function checkField(group: GroupId, s: FieldSpec, v: unknown): Problem | null {
  const bad = (code: string, params?: Record<string, string | number>): Problem => ({ group, path: s.path, code, params });
  if (v === undefined) return bad("required");
  if (v === null) return s.nullable ? null : bad("required");
  switch (s.kind) {
    case "int":
    case "number": {
      if (typeof v !== "number" || !Number.isFinite(v)) return bad("number");
      if (s.kind === "int" && !Number.isInteger(v)) return bad("integer");
      const lo = s.min ?? -Infinity, hi = s.max ?? Infinity;
      if (s.minExclusive ? v <= lo : v < lo) return bad(s.minExclusive ? "range_open" : "range", { min: lo, max: hi });
      if (v > hi) return bad(s.minExclusive ? "range_open" : "range", { min: lo, max: hi });
      return null;
    }
    case "bool":
      if (typeof v !== "boolean") return bad("boolean");
      return s.locked && v !== true ? bad("locked") : null;
    case "enum":
      return typeof v === "string" && s.options?.includes(v) ? null : bad("option");
    case "hex":
      return typeof v === "string" && HEX.test(v) ? null : bad("colour");
    case "uuid":
      return typeof v === "string" && UUID.test(v) ? null : bad("identifier");
    case "tz":
      return typeof v === "string" && v.length <= 64 && validTimeZone(v) ? null : bad("timezone");
  }
}

/** C-045: could 100 colleagues behind one office address all sign in? Limits are per email and per browser (never per IP). */
export function officeCanSignIn(s: { rateRequestsPerEmail: number; rateRequestsPerBrowser: number }): boolean {
  // Each colleague has their own email and browser, so each needs `requestsPerSignIn` requests inside the window.
  return s.rateRequestsPerEmail >= FIXED.requestsPerSignIn && s.rateRequestsPerBrowser >= FIXED.requestsPerSignIn;
}

/** Validates a whole group's values (individually and as a set). Returns every problem; empty means valid. */
export function validateGroup(group: GroupId, kind: ScopeKind, values: unknown): Problem[] {
  const specs = fieldsOf(group, kind);
  if (values === null || typeof values !== "object" || Array.isArray(values)) return [{ group, path: "", code: "object" }];
  const problems: Problem[] = [];
  const known = new Set(specs.map((s) => s.path));
  for (const p of Object.keys(flatten(values))) if (!known.has(p)) problems.push({ group, path: p, code: "unknown" });
  const bad = new Set<string>();
  for (const s of specs) {
    const p = checkField(group, s, getPath(values, s.path));
    if (p) { problems.push(p); bad.add(s.path); }
  }
  const v = values as Values;
  const n = (p: string) => getPath(v, p) as number;
  const ok = (...paths: string[]) => paths.every((p) => !bad.has(p));
  const add = (path: string, code: string, params?: Record<string, string | number>) => problems.push({ group, path, code, params });

  if (kind === "programme" && group === "cadence_capacity") {
    if (ok("capacityDefault", "capacityMax") && n("capacityMax") < n("capacityDefault")) add("capacityMax", "capacity_max_below_default", { default: n("capacityDefault") });
  }
  if (kind === "programme" && group === "matching") {
    if (ok("depthFactors.working", "depthFactors.advanced", "depthFactors.expert") && !(n("depthFactors.working") <= n("depthFactors.advanced") && n("depthFactors.advanced") <= n("depthFactors.expert")))
      add("depthFactors", "depth_order");
    if (ok("languageScores.fluent", "languageScores.working") && n("languageScores.fluent") < n("languageScores.working")) add("languageScores.fluent", "language_order");
    const wp = WEIGHT_KEYS.map((k) => `weights.${k}`);
    if (ok(...wp)) {
      const total = wp.reduce((a, p) => a + n(p), 0);
      if (total !== 100) add("weights", "weights_total", { total });
    }
    const gp = ["peerMin", "peerMax", "aheadMin", "aheadMax", "farMin"].map((k) => `careerGaps.${k}`);
    if (ok(...gp)) {
      const g = (k: string) => n(`careerGaps.${k}`);
      if (g("peerMin") > g("peerMax") || g("aheadMin") > g("aheadMax")) add("careerGaps", "bands_overlap");
      else if (g("aheadMin") > g("peerMax") + 1 || g("farMin") > g("aheadMax") + 1) add("careerGaps", "bands_gap");
      else if (g("aheadMin") <= g("peerMax") || g("farMin") <= g("aheadMax")) add("careerGaps", "bands_overlap");
    }
  }
  if (kind === "programme" && group === "timings") {
    // C-003: strictly before the Open request expires (C-002); a lead time must fit inside the window it relates to.
    const rel = (p: string, limit: number, unit: string) => {
      if (ok(p) && n(p) >= limit) add(p, "before_event", { limit, unit });
    };
    rel("openRequestReminderDays", FIXED.openRequestExpiryDays, "days");
    rel("proposalReminderLeadDays", FIXED.proposalWindowDays, "days");
    rel("noGoalNudgeDays", FIXED.acceptedNoSessionDays, "days");
  }
  if (kind === "organisation" && group === "security") {
    if (ok("sessionIdleMinutes", "sessionAbsoluteDays") && n("sessionIdleMinutes") > n("sessionAbsoluteDays") * 24 * 60) add("sessionIdleMinutes", "idle_above_absolute");
    if (ok("rateRequestsPerEmail", "rateRequestsPerBrowser")) {
      if (n("rateRequestsPerBrowser") < n("rateRequestsPerEmail")) add("rateRequestsPerBrowser", "browser_below_email", { email: n("rateRequestsPerEmail") });
      if (!officeCanSignIn({ rateRequestsPerEmail: n("rateRequestsPerEmail"), rateRequestsPerBrowser: n("rateRequestsPerBrowser") }))
        add("rateRequestsPerEmail", "office_sign_in", { colleagues: FIXED.officeColleagues });
    }
  }
  if (kind === "organisation" && group === "admin_ops") {
    if (ok("dueSoonLeadDays", "responseTargetDays") && n("dueSoonLeadDays") >= n("responseTargetDays")) add("dueSoonLeadDays", "before_event", { limit: n("responseTargetDays"), unit: "days" });
  }
  if (kind === "organisation" && group === "brand") {
    if (ok(...BRAND_TOKENS)) {
      const tokens = Object.fromEntries(BRAND_TOKENS.map((k) => [k, getPath(v, k)])) as BrandTokens;
      for (const f of contrastFailures(tokens))
        add(`contrast.${f.theme}.${f.fg}.${f.bg}`, "contrast", { theme: f.theme, fg: f.fg, bg: f.bg, ratio: f.ratio, min: f.min });
    }
  }
  return problems;
}

/** Feature-flag prerequisites (AC-PRG-05.2): a flag may be true only when its approval is recorded. */
export function flagPrerequisiteProblems(kind: ScopeKind, values: unknown, recorded: ReadonlySet<Prerequisite>): Problem[] {
  const out: Problem[] = [];
  for (const [flag, need] of Object.entries(FLAG_PREREQUISITE[kind])) {
    if (need && getPath(values, flag) === true && !recorded.has(need)) out.push({ group: "flags", path: flag, code: "prerequisite", params: { prerequisite: need } });
  }
  return out;
}

/** Fills keys missing from stored values with the defaults (forward-compatible reads); stored values win. */
export function withDefaults(group: GroupId, kind: ScopeKind, stored: unknown, type: ProgrammeType): Values {
  const base = defaultValues(group, kind, type);
  return stored !== null && typeof stored === "object" && !Array.isArray(stored) ? deepMerge(base, stored as Values) : base;
}
