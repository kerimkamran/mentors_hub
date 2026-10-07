/**
 * Matching engine types (matching-spec §1.1 snapshot, §3 exclusions, §4 scoring, §6 explanations).
 *
 * PURE: no database, framework, clock or randomness. The caller assembles a `MatchingSnapshot`
 * from relational data (see docs/ENGINES.md for the table-to-field mapping) and passes the programme's
 * `MatchingSettings` (constants §0) alongside it. Only fields declared here are ever read (MT-P5).
 */

export type PersonId = string;
export type TagId = string;
/** Calendar date `YYYY-MM-DD` (the caller supplies `as_of`; the engine never reads a clock). */
export type IsoDate = string;

export type ProgrammeType = "open" | "leadership" | "sparklab";
export type Depth = "working" | "advanced" | "expert";
export type Proficiency = "working" | "fluent";
export type Phase = "develop" | "design" | "test";
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // Monday = 1 (C-111)
export type Locale = "en" | "az" | "ru";

export const CRITERIA = ["goal", "expertise", "availability", "career", "language", "interests", "other"] as const;
export type Criterion = (typeof CRITERIA)[number];

export const EXCLUSION_CODES = [
  "SAME_PERSON",
  "BLOCKED",
  "NOT_APPROVED",
  "ELIGIBILITY",
  "INCOMPATIBLE_HISTORY",
  "DECLINED_RECENTLY",
  "REPORTING_LINE",
  "REPORTING_PEER",
  "MENTOR_JUNIOR",
  "NO_LANGUAGE",
  "NO_AVAILABILITY",
  "CAPACITY_FULL",
  "ALREADY_MATCHED",
] as const;
export type ExclusionCode = (typeof EXCLUSION_CODES)[number];

/** Exclusions that can never be switched off or overridden (matching-spec §3, C-080 … C-082). */
export const LOCKED_EXCLUSIONS: readonly ExclusionCode[] = ["SAME_PERSON", "BLOCKED", "NOT_APPROVED"];

/** Constant id of each exclusion switch (constants §6). */
export const EXCLUSION_CONSTANT_IDS: Record<ExclusionCode, string> = {
  SAME_PERSON: "C-080",
  BLOCKED: "C-081",
  NOT_APPROVED: "C-082",
  ELIGIBILITY: "C-083",
  INCOMPATIBLE_HISTORY: "C-084",
  DECLINED_RECENTLY: "C-085",
  REPORTING_LINE: "C-086",
  REPORTING_PEER: "C-087",
  MENTOR_JUNIOR: "C-088",
  NO_LANGUAGE: "C-089",
  NO_AVAILABILITY: "C-090",
  CAPACITY_FULL: "C-091",
  ALREADY_MATCHED: "C-092",
};

export const isLocked = (code: ExclusionCode) => LOCKED_EXCLUSIONS.includes(code);

/* ------------------------------------------------------------------------------------------ */
/* Settings (matching settings version — constants §0)                                         */
/* ------------------------------------------------------------------------------------------ */

export type CareerBandName = "mentor_junior" | "peer" | "ahead" | "far";

export interface CareerBand {
  band: CareerBandName;
  /** Inclusive lower bound of `gap = mentor bucket − mentee bucket`; null = unbounded. */
  minGap: number | null;
  /** Inclusive upper bound; null = unbounded. */
  maxGap: number | null;
  /** Sub-score in [0, 1] (C-054). */
  score: number;
}

export interface MatchingSettings {
  /** Id of the stored settings version; echoed in every result (INV-7.4, MT-P11). */
  versionId: string;
  /** Per-criterion weights; non-negative integers totalling exactly 100 (C-070 / C-071 / C-072). */
  weights: Record<Criterion, number>;
  /** Expertise depth factors, in (0, 1], working ≤ advanced ≤ expert (C-050). */
  depthFactors: Record<Depth, number>;
  /** Primary-goal weight multiplier, integer 1–5 (C-051). */
  primaryGoalMultiplier: number;
  /** Parent/child taxonomy partial credit in [0, 1] (C-052). */
  taxonomyPartialCredit: number;
  /** Availability saturation: this many overlapping days per week = full score, integer 1–7 (C-053). */
  availabilitySaturationDays: number;
  /** Career bands (C-054, C-055): must cover every integer gap exactly once. */
  careerBands: CareerBand[];
  /** Language sub-scores in [0, 1], fluent ≥ working (C-056). */
  languageScores: { fluent: number; working: number };
  /** Neutral score for a missing mentee/team answer, [0, 1] (C-057). */
  neutralScore: number;
  /** Score for a missing mentor answer (C-058, FIXED = 0). */
  missingMentorScore: number;
  /** Reason inclusion threshold in (0, 1] (C-059). */
  reasonThreshold: number;
  /** A reason true for at least this share of the scored pool is dropped, (0, 1] (C-060). */
  commonReasonCutoff: number;
  /** Exclusion switches (C-080 … C-092). SAME_PERSON, BLOCKED and NOT_APPROVED must be true. */
  exclusions: Record<ExclusionCode, boolean>;
  /** Availability horizon in weeks, 1–12 (C-150). */
  availabilityHorizonWeeks: number;
  /** Decline cool-off in days (C-004). */
  declineCooldownDays: number;
  /** Team slot quorum, share of members free incl. the lead, (0, 1] (C-027). */
  teamQuorum: number;
  /** Recommended list size (C-024). */
  recommendedListSize: number;
  /** Maximum reasons shown (C-034). */
  maxReasons: number;
  /** Maximum open requests per mentee (C-023); used by ALREADY_MATCHED in Open programmes. */
  openRequestLimit: number;
  /** Decimal places kept for sub-scores and totals (C-061). */
  scorePrecision: number;
  /** SparkLab: multiplier on Expertise when the mentor lacks the team's phase (OQ-B1-17), (0, 1]. */
  phaseMismatchMultiplier: number;
  /** Slot-grid cell length in minutes, 15–120 (engine parameter; matching-spec §4.3 "generated slot grid"). */
  slotMinutes: number;
}

/* ------------------------------------------------------------------------------------------ */
/* Snapshot (matching-spec §1.1)                                                               */
/* ------------------------------------------------------------------------------------------ */

export interface Labels {
  en: string;
  az: string;
  ru: string;
}

export interface TaxonomyTag {
  id: TagId;
  /** Parent in the taxonomy (null for a root). */
  parentId: TagId | null;
  /** Synonym normalisation: if set, this tag is a synonym of the canonical tag. */
  canonicalId: TagId | null;
  labels: Labels;
}

export interface InterestTag {
  id: string;
  labels: Labels;
}

/** Recurring weekly availability (mentor rule or mentee window), expressed in ONE time zone chosen by the caller (the organisation's). */
export interface AvailabilityRule {
  weekday: Weekday;
  /** Minutes from midnight, 0–1439. */
  startMinute: number;
  /** Minutes from midnight, 1–1440, greater than startMinute. */
  endMinute: number;
  validFrom: IsoDate | null;
  validTo: IsoDate | null;
}

export interface LanguageSkill {
  /** ISO 639-1 code, e.g. `az`, `en`, `ru`. */
  language: string;
  level: Proficiency;
}

/** HR input 2 — never displayed (matching-spec §1.1). */
export interface ReportingLine {
  managerId: PersonId | null;
  skipLevelId: PersonId | null;
}

export interface QuestionnaireQuestion {
  id: string;
  section: "character" | "field" | "experience";
  mode: "similar" | "complementary";
  scaleMin: number;
  scaleMax: number;
}

/** Only answers the person marked "available to matching". */
export interface CompatAnswer {
  questionId: string;
  value: number;
}

export interface TopicOffer {
  tagId: TagId;
  depth: Depth;
}

/** Fields of one person who sits on the seeking side (a mentee, or one member of a team). */
export interface MemberInput {
  personId: PersonId;
  /** Result of the programme eligibility rule, computed by the caller (ELIGIBILITY / C-083). */
  eligible: boolean;
  /** HR input 1 — grade BUCKET (never a raw grade number); null when unknown. Never displayed. */
  gradeBucket: number | null;
  /** HR input 2 — never displayed. */
  reporting: ReportingLine;
  /** null = not provided. */
  languages: LanguageSkill[] | null;
  interests: string[] | null;
  availability: AvailabilityRule[] | null;
  compat: CompatAnswer[] | null;
}

/** A goal the mentee has made available to matching ("shared" in matching-spec §4.1). */
export interface SeekerGoal {
  id: string;
  primary: boolean;
  tags: TagId[];
  /** Present ONLY when the mentee shared this goal in a request (FR-MAT-011). Never read otherwise. */
  sharedTitle?: string | null;
}

export interface SeekerInput {
  /** Mentee person id, or team id. */
  id: string;
  kind: "mentee" | "team";
  organisationId: string;
  /** Mentee: exactly the mentee. Team: every member including the lead. */
  members: MemberInput[];
  /** Mentee: the mentee. Team: the team lead (career, language, interests, questionnaire are taken from the lead). */
  leadPersonId: PersonId;
  /** Mentee's shared goals (empty for a team). */
  goals: SeekerGoal[];
  /** Team's needed expertise (empty for a mentee) — replaces goal tags in §4.1/§4.2. */
  neededExpertise: TagId[];
  /** Team's current phase (SparkLab). */
  phase: Phase | null;
  /** Accepted / pending matches this seeker already has in the programme (ALREADY_MATCHED). */
  acceptedMatches: number;
  pendingMatches: number;
}

/** Which of the mentor's fields the seeker may see (per-field visibility, resolved by the caller). Gate for explanations. */
export interface MentorVisibility {
  topics: boolean;
  availability: boolean;
  languages: boolean;
  interests: boolean;
  questionnaire: boolean;
}

export interface MentorInput {
  personId: PersonId;
  organisationId: string;
  /** Approved mentor in this programme (D9; Open: approved by PM). */
  approved: boolean;
  /** Minimum profile met (C-032). */
  minimumProfile: boolean;
  /** Result of the programme eligibility rule for the mentor, computed by the caller (ELIGIBILITY / C-083). */
  eligible: boolean;
  /** A PM marked this not-recommendable mentor as browsable; they stay out of `recommended` and drafts. */
  browsableWithoutMinimumProfile: boolean;
  /** Capacity units (C-021); a team uses one unit (C-022). */
  capacity: number;
  /** Current load in units (accepted relationships; teams count 1 each). */
  load: number;
  topics: TopicOffer[];
  /** Phases the mentor has experience of (SparkLab, OQ-B1-17). */
  phases: Phase[];
  gradeBucket: number | null;
  reporting: ReportingLine;
  languages: LanguageSkill[] | null;
  interests: string[] | null;
  availability: AvailabilityRule[] | null;
  compat: CompatAnswer[] | null;
  visible: MentorVisibility;
}

export interface BlockEntry {
  blockerId: PersonId;
  blockedId: PersonId;
}

export type HistoryKind = "incompatible" | "declined" | "rematch_previous";

/** Relationship history of a seeker–mentor pair. `seekerId` is a seeker id (mentee / team) or a member's person id. */
export interface PairHistoryEntry {
  seekerId: string;
  mentorId: PersonId;
  kind: HistoryKind;
  /** Date of the decline (required for `declined`). */
  on: IsoDate | null;
}

/** A PM override of one overridable exclusion for one seeker–mentor pair (matching-spec §3 rule 3). */
export interface ExclusionOverride {
  seekerId: string;
  mentorId: PersonId;
  code: ExclusionCode;
}

export interface MatchingSnapshot {
  organisationId: string;
  programme: { id: string; type: ProgrammeType; asOf: IsoDate };
  taxonomy: TaxonomyTag[];
  interestCatalogue: InterestTag[];
  /** Programme-configured compatibility questions (§4.7); empty = criterion neutral for everyone. */
  questionnaire: QuestionnaireQuestion[];
  seekers: SeekerInput[];
  mentors: MentorInput[];
  blocks: BlockEntry[];
  history: PairHistoryEntry[];
  overrides: ExclusionOverride[];
}

/* ------------------------------------------------------------------------------------------ */
/* Output                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export type MatchingMode = "recommend" | "draft";

export type SubScoreStatus = "scored" | "neutral_seeker_missing" | "mentor_missing" | "unweighted";

export interface CriterionScore {
  criterion: Criterion;
  weight: number;
  /** In [0, 1], rounded to `scorePrecision`; 0 when unweighted. */
  subscore: number;
  /** weight × subscore. */
  contribution: number;
  status: SubScoreStatus;
}

/** Reason codes (max C-034 per candidate). Never contain scores, percentages, grades, reporting-line facts or exclusions. */
export type ReasonCode =
  | { code: "GOAL_ALIGNMENT"; topic: Labels; goalPosition: "first" | "other" | "team" }
  | { code: "EXPERTISE"; topic: Labels; depth: Depth }
  | { code: "AVAILABILITY"; days: number }
  | { code: "CAREER"; band: "ahead" | "peer" | "far" }
  | { code: "LANGUAGE"; languages: string[] }
  | { code: "INTERESTS"; interest: Labels }
  | { code: "COMPATIBILITY" }
  | { code: "GENERIC_FIT" };

/** Mentor-view reason codes: topic labels only; goal title only when the mentee shared it (FR-MAT-011). */
export type MentorReasonCode =
  | { code: "MENTOR_SEEKS_TOPIC"; topic: Labels; goalTitle?: string }
  | { code: "MENTOR_GENERIC_FIT" };

export interface CandidateExclusion {
  code: ExclusionCode;
  /** Never overridable (SAME_PERSON, BLOCKED, NOT_APPROVED). */
  locked: boolean;
  /** A PM override record exists for this pair and code (ignored for locked codes). */
  overridden: boolean;
}

export interface RankedCandidate {
  mentorId: PersonId;
  /** 1-based position in the seeker's ranking. */
  rank: number;
  /** 0–100, rounded to `scorePrecision`. */
  total: number;
  /** Always the seven criteria in fixed order (PM view). */
  breakdown: CriterionScore[];
  /** Exclusions that apply but were overridden by the PM (PM view). */
  overriddenCodes: ExclusionCode[];
  /** Mentor has the minimum profile; false = browsable by PM decision only, never recommended or auto-assigned. */
  recommendable: boolean;
  explanation: { mentee: ReasonCode[]; mentor: MentorReasonCode[] };
}

export interface ExcludedPair {
  mentorId: PersonId;
  /** Internal codes — PM view only. Users see only the neutral line (FR-MAT-003). */
  exclusions: CandidateExclusion[];
}

export interface SeekerResult {
  seekerId: string;
  kind: "mentee" | "team";
  /** Size of the scored pool (ranked candidates). */
  poolSize: number;
  candidates: RankedCandidate[];
  /** First `recommendedListSize` recommendable candidates (mentor ids, ranked). */
  recommended: PersonId[];
  excluded: ExcludedPair[];
  outOfPool: { mentorId: PersonId; reason: "MINIMUM_PROFILE" | "ORGANISATION" }[];
}

export interface DraftAssignment {
  seekerId: string;
  mentorId: PersonId;
  rank: number;
  total: number;
}

export interface DraftResult {
  /** In processing order (fewest options first, then seeker id). */
  assignments: DraftAssignment[];
  /** Seekers with no available mentor, in processing order. */
  unmatched: string[];
}

export interface MatchingResult {
  engineVersion: string;
  settingsVersionId: string;
  /** SHA-256 of the canonical snapshot (only engine-relevant fields) + settings. */
  snapshotHash: string;
  mode: MatchingMode;
  programmeType: ProgrammeType;
  asOf: IsoDate;
  seekers: SeekerResult[];
  draft: DraftResult | null;
}

export class InvalidMatchingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMatchingInputError";
  }
}

export class InvalidSettingsError extends Error {
  readonly errors: SettingsError[];
  constructor(errors: SettingsError[]) {
    super(`invalid matching settings: ${errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`);
    this.name = "InvalidSettingsError";
    this.errors = errors;
  }
}

export interface SettingsError {
  path: string;
  message: string;
}
