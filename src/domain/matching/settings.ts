import {
  CRITERIA,
  EXCLUSION_CODES,
  InvalidSettingsError,
  LOCKED_EXCLUSIONS,
  type CareerBand,
  type CareerBandName,
  type ExclusionCode,
  type MatchingSettings,
  type ProgrammeType,
  type SettingsError,
} from "./types";

/** Engine version stored with every match (C-062, FIXED semantic version string). */
export const ENGINE_VERSION = "1.0.0";

/** Default weights per programme type (constants §5: C-070 Open, C-071 Leadership, C-072 SparkLab). */
const WEIGHTS: Record<ProgrammeType, MatchingSettings["weights"]> = {
  open: { goal: 30, expertise: 25, availability: 15, career: 10, language: 10, interests: 5, other: 5 }, // C-070
  leadership: { goal: 25, expertise: 25, availability: 5, career: 15, language: 10, interests: 0, other: 20 }, // C-071
  sparklab: { goal: 35, expertise: 30, availability: 15, career: 10, language: 10, interests: 0, other: 0 }, // C-072
};

/** Default exclusion switches per programme type (constants §6, C-080 … C-092). */
const EXCLUSIONS: Record<ProgrammeType, Record<ExclusionCode, boolean>> = (() => {
  const base: Record<ExclusionCode, boolean> = {
    SAME_PERSON: true, // C-080 (never off)
    BLOCKED: true, // C-081 (never off)
    NOT_APPROVED: true, // C-082 (never off)
    ELIGIBILITY: true, // C-083
    INCOMPATIBLE_HISTORY: true, // C-084
    DECLINED_RECENTLY: true, // C-085
    REPORTING_LINE: true, // C-086
    REPORTING_PEER: false, // C-087 (Leadership only by default)
    MENTOR_JUNIOR: false, // C-088 (Leadership only by default)
    NO_LANGUAGE: true, // C-089
    NO_AVAILABILITY: true, // C-090
    CAPACITY_FULL: true, // C-091
    ALREADY_MATCHED: true, // C-092
  };
  return {
    open: { ...base },
    leadership: { ...base, REPORTING_PEER: true, MENTOR_JUNIOR: true },
    sparklab: { ...base },
  };
})();

const CAREER_BANDS: CareerBand[] = [
  { band: "mentor_junior", minGap: null, maxGap: -1, score: 0.3 }, // C-054
  { band: "peer", minGap: 0, maxGap: 0, score: 0.6 }, // C-054, C-055
  { band: "ahead", minGap: 1, maxGap: 2, score: 1.0 }, // C-054, C-055
  { band: "far", minGap: 3, maxGap: null, score: 0.4 }, // C-054, C-055
];

function makeDefaults(type: ProgrammeType): MatchingSettings {
  return {
    versionId: `defaults-${type}`,
    weights: { ...WEIGHTS[type] },
    depthFactors: { working: 0.5, advanced: 0.75, expert: 1.0 }, // C-050
    primaryGoalMultiplier: 2, // C-051
    taxonomyPartialCredit: 0.5, // C-052
    availabilitySaturationDays: 3, // C-053
    careerBands: CAREER_BANDS.map((b) => ({ ...b })),
    languageScores: { fluent: 1.0, working: 0.7 }, // C-056
    neutralScore: 0.5, // C-057
    missingMentorScore: 0, // C-058 (FIXED)
    reasonThreshold: 0.6, // C-059
    commonReasonCutoff: 0.9, // C-060
    exclusions: { ...EXCLUSIONS[type] },
    availabilityHorizonWeeks: 4, // C-150
    declineCooldownDays: 90, // C-004
    teamQuorum: 0.6, // C-027
    recommendedListSize: 5, // C-024
    maxReasons: 3, // C-034
    openRequestLimit: 2, // C-023
    scorePrecision: 2, // C-061
    phaseMismatchMultiplier: 0.8, // OQ-B1-17
    slotMinutes: 30,
  };
}

/** Starting defaults installed when a programme is created (constants §0, §4–§6, §12). Always returns a fresh copy via `defaultMatchingSettings`. */
export const DEFAULT_MATCHING_SETTINGS: Readonly<Record<ProgrammeType, Readonly<MatchingSettings>>> = Object.freeze({
  open: makeDefaults("open"),
  leadership: makeDefaults("leadership"),
  sparklab: makeDefaults("sparklab"),
});

export function defaultMatchingSettings(type: ProgrammeType, versionId?: string): MatchingSettings {
  const d = makeDefaults(type);
  return versionId === undefined ? d : { ...d, versionId };
}

/* ------------------------------------------------------------------------------------------ */
/* Validation (MT-P12): every bound of constants §0 is enforced before values reach the engine.  */
/* ------------------------------------------------------------------------------------------ */

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isInt = (x: unknown): x is number => isNum(x) && Number.isInteger(x);
const inRange = (x: unknown, lo: number, hi: number): x is number => isNum(x) && x >= lo && x <= hi;
const BAND_ORDER: CareerBandName[] = ["mentor_junior", "peer", "ahead", "far"];

export function validateMatchingSettings(s: MatchingSettings): { ok: true } | { ok: false; errors: SettingsError[] } {
  const errors: SettingsError[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });
  const x = s as unknown as Record<string, unknown> | null;
  if (!x || typeof x !== "object") return { ok: false, errors: [{ path: "", message: "settings missing" }] };

  if (typeof s.versionId !== "string" || s.versionId.length === 0) err("versionId", "a settings version id is required");

  // C-070 … C-072: non-negative integers totalling exactly 100.
  const w = s.weights as Record<string, unknown> | undefined;
  if (!w) err("weights", "missing");
  else {
    let total = 0;
    for (const c of CRITERIA) {
      const v = w[c];
      if (!isInt(v) || v < 0) err(`weights.${c}`, "must be a non-negative integer");
      else total += v;
    }
    if (total !== 100) err("weights", `must total exactly 100 (got ${total})`);
  }

  // C-050: factors in (0, 1], ordered working ≤ advanced ≤ expert.
  const d = s.depthFactors;
  if (!d) err("depthFactors", "missing");
  else {
    for (const k of ["working", "advanced", "expert"] as const) if (!isNum(d[k]) || d[k] <= 0 || d[k] > 1) err(`depthFactors.${k}`, "must be in (0, 1]");
    if (isNum(d.working) && isNum(d.advanced) && isNum(d.expert) && !(d.working <= d.advanced && d.advanced <= d.expert)) err("depthFactors", "must be ordered working ≤ advanced ≤ expert");
  }
  if (!isInt(s.primaryGoalMultiplier) || s.primaryGoalMultiplier < 1 || s.primaryGoalMultiplier > 5) err("primaryGoalMultiplier", "must be an integer 1–5"); // C-051
  if (!inRange(s.taxonomyPartialCredit, 0, 1)) err("taxonomyPartialCredit", "must be in [0, 1]"); // C-052
  if (!isInt(s.availabilitySaturationDays) || s.availabilitySaturationDays < 1 || s.availabilitySaturationDays > 7) err("availabilitySaturationDays", "must be an integer 1–7"); // C-053

  // C-054 / C-055: each band score in [0, 1]; the four bands cover every integer gap exactly once, in order.
  validateBands(s.careerBands, err);

  const l = s.languageScores; // C-056
  if (!l) err("languageScores", "missing");
  else {
    if (!inRange(l.fluent, 0, 1)) err("languageScores.fluent", "must be in [0, 1]");
    if (!inRange(l.working, 0, 1)) err("languageScores.working", "must be in [0, 1]");
    if (isNum(l.fluent) && isNum(l.working) && l.fluent < l.working) err("languageScores", "fluent must be at least working");
  }

  if (!inRange(s.neutralScore, 0, 1)) err("neutralScore", "must be in [0, 1]"); // C-057
  if (!inRange(s.missingMentorScore, 0, 1)) err("missingMentorScore", "must be in [0, 1]"); // C-058
  if (!isNum(s.reasonThreshold) || s.reasonThreshold <= 0 || s.reasonThreshold > 1) err("reasonThreshold", "must be in (0, 1]"); // C-059
  if (!isNum(s.commonReasonCutoff) || s.commonReasonCutoff <= 0 || s.commonReasonCutoff > 1) err("commonReasonCutoff", "must be in (0, 1]"); // C-060

  const e = s.exclusions as Record<string, unknown> | undefined; // C-080 … C-092
  if (!e) err("exclusions", "missing");
  else {
    for (const code of EXCLUSION_CODES) if (typeof e[code] !== "boolean") err(`exclusions.${code}`, "must be true or false");
    for (const code of LOCKED_EXCLUSIONS) if (e[code] !== true) err(`exclusions.${code}`, "can never be switched off");
  }

  if (!isInt(s.availabilityHorizonWeeks) || s.availabilityHorizonWeeks < 1 || s.availabilityHorizonWeeks > 12) err("availabilityHorizonWeeks", "must be an integer 1–12 weeks"); // C-150
  if (!isInt(s.declineCooldownDays) || s.declineCooldownDays < 0 || s.declineCooldownDays > 730) err("declineCooldownDays", "must be an integer 0–730"); // C-004
  if (!isNum(s.teamQuorum) || s.teamQuorum <= 0 || s.teamQuorum > 1) err("teamQuorum", "must be in (0, 1]"); // C-027
  if (!isInt(s.recommendedListSize) || s.recommendedListSize < 1 || s.recommendedListSize > 50) err("recommendedListSize", "must be an integer 1–50"); // C-024
  if (!isInt(s.maxReasons) || s.maxReasons < 1 || s.maxReasons > 5) err("maxReasons", "must be an integer 1–5"); // C-034
  if (!isInt(s.openRequestLimit) || s.openRequestLimit < 1 || s.openRequestLimit > 10) err("openRequestLimit", "must be an integer 1–10"); // C-023
  if (!isInt(s.scorePrecision) || s.scorePrecision < 0 || s.scorePrecision > 4) err("scorePrecision", "must be an integer 0–4"); // C-061
  if (!isNum(s.phaseMismatchMultiplier) || s.phaseMismatchMultiplier <= 0 || s.phaseMismatchMultiplier > 1) err("phaseMismatchMultiplier", "must be in (0, 1]");
  if (!isInt(s.slotMinutes) || s.slotMinutes < 15 || s.slotMinutes > 120 || 1440 % s.slotMinutes !== 0) err("slotMinutes", "must be an integer 15–120 that divides 1440");

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function validateBands(bands: CareerBand[] | undefined, err: (path: string, message: string) => void): void {
  if (!Array.isArray(bands) || bands.length !== 4) return err("careerBands", "must contain exactly the four bands");
  const names = bands.map((b) => b.band);
  if (BAND_ORDER.some((n, i) => names[i] !== n)) return err("careerBands", `must be listed in the order ${BAND_ORDER.join(", ")}`);
  let ok = true;
  bands.forEach((b, i) => {
    if (!inRange(b.score, 0, 1)) {
      err(`careerBands.${b.band}.score`, "must be in [0, 1]");
      ok = false;
    }
    if ((b.minGap !== null && !isInt(b.minGap)) || (b.maxGap !== null && !isInt(b.maxGap))) {
      err(`careerBands.${b.band}`, "gap bounds must be integers or null");
      ok = false;
    }
    if (i === 0 && b.minGap !== null) err("careerBands", "the first band must be unbounded below"), (ok = false);
    if (i === bands.length - 1 && b.maxGap !== null) err("careerBands", "the last band must be unbounded above"), (ok = false);
  });
  if (!ok) return;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]!;
    if (b.minGap !== null && b.maxGap !== null && b.minGap > b.maxGap) err(`careerBands.${b.band}`, "minGap must not exceed maxGap");
    const next = bands[i + 1];
    if (next && (b.maxGap === null || next.minGap === null || next.minGap !== b.maxGap + 1)) err("careerBands", "bands must cover every gap value without overlap or gaps");
  }
}

/** Throws `InvalidSettingsError` (fail closed, INV-8) when the settings are out of bounds. */
export function assertValidSettings(s: MatchingSettings): void {
  const r = validateMatchingSettings(s);
  if (!r.ok) throw new InvalidSettingsError(r.errors);
}
