import {
  InvalidMatchingInputError,
  isLocked,
  type AvailabilityRule,
  type BlockEntry,
  type CompatAnswer,
  type Depth,
  type ExclusionCode,
  type ExclusionOverride,
  type InterestTag,
  type IsoDate,
  type Labels,
  type LanguageSkill,
  type MatchingSettings,
  type MatchingSnapshot,
  type MemberInput,
  type MentorInput,
  type PairHistoryEntry,
  type QuestionnaireQuestion,
  type ReportingLine,
  type SeekerGoal,
  type SeekerInput,
  type TaxonomyTag,
  type TopicOffer,
  type Weekday,
} from "./types";

/**
 * Canonicalisation (MT-P3, MT-P5, MT-P2):
 *  - projects every object onto the fields declared in types.ts, so unknown/private fields can never reach scoring or the hash;
 *  - sorts and de-duplicates every collection, so input order never matters;
 *  - blanks the fields of criteria/exclusions that the settings switch off (weight 0 / switch off), so a criterion with weight 0
 *    "never reads that criterion's fields" and cannot influence any output, including the snapshot hash.
 */

export interface Needs {
  topics: boolean;
  phases: boolean;
  availability: boolean;
  career: boolean;
  language: boolean;
  interests: boolean;
  other: boolean;
  reporting: boolean;
  eligibility: boolean;
  incompatible: boolean;
  declined: boolean;
  alreadyMatched: boolean;
}

export function needsOf(s: MatchingSettings): Needs {
  const w = s.weights;
  const x = s.exclusions;
  return {
    topics: w.goal > 0 || w.expertise > 0,
    phases: w.expertise > 0,
    availability: w.availability > 0 || x.NO_AVAILABILITY,
    career: w.career > 0 || x.MENTOR_JUNIOR,
    language: w.language > 0 || x.NO_LANGUAGE,
    interests: w.interests > 0,
    other: w.other > 0,
    reporting: x.REPORTING_LINE || x.REPORTING_PEER,
    eligibility: x.ELIGIBILITY,
    incompatible: x.INCOMPATIBLE_HISTORY,
    declined: x.DECLINED_RECENTLY,
    alreadyMatched: x.ALREADY_MATCHED,
  };
}

const bad = (m: string): never => {
  throw new InvalidMatchingInputError(m);
};

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const uniqSorted = (xs: readonly string[]): string[] => [...new Set(xs)].sort(cmp);
const str = (x: unknown, what: string): string => (typeof x === "string" && x.length > 0 ? x : bad(`${what} must be a non-empty string`));
const arr = <T>(x: readonly T[] | null | undefined, what: string): readonly T[] => (Array.isArray(x) ? x : bad(`${what} must be an array`));
const bool = (x: unknown) => x === true;
const optNum = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

export function isIsoDate(x: unknown): x is IsoDate {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const [y, m, d] = x.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function labels(l: Labels | undefined, what: string): Labels {
  return { en: str(l?.en, `${what}.en`), az: str(l?.az, `${what}.az`), ru: str(l?.ru, `${what}.ru`) };
}

function reporting(r: ReportingLine | undefined, n: Needs): ReportingLine {
  if (!n.reporting) return { managerId: null, skipLevelId: null };
  return { managerId: typeof r?.managerId === "string" && r.managerId ? r.managerId : null, skipLevelId: typeof r?.skipLevelId === "string" && r.skipLevelId ? r.skipLevelId : null };
}

function languages(l: readonly LanguageSkill[] | null | undefined, on: boolean): LanguageSkill[] | null {
  if (!on || l === null || l === undefined) return null;
  const best = new Map<string, "working" | "fluent">();
  for (const x of arr(l, "languages")) {
    const code = str(x.language, "language");
    const level = x.level === "fluent" ? "fluent" : "working";
    if (best.get(code) !== "fluent") best.set(code, level);
  }
  return [...best].map(([language, level]) => ({ language, level })).sort((a, b) => cmp(a.language, b.language));
}

function interests(i: readonly string[] | null | undefined, on: boolean): string[] | null {
  if (!on || i === null || i === undefined) return null;
  return uniqSorted(arr(i, "interests").map((x) => str(x, "interest")));
}

function availability(rules: readonly AvailabilityRule[] | null | undefined, on: boolean): AvailabilityRule[] | null {
  if (!on || rules === null || rules === undefined) return null;
  const out = arr(rules, "availability").map((r): AvailabilityRule => {
    const weekday = r.weekday as number;
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) bad("availability weekday must be 1–7");
    if (!Number.isInteger(r.startMinute) || !Number.isInteger(r.endMinute) || r.startMinute < 0 || r.endMinute > 1440 || r.startMinute >= r.endMinute) bad("availability minutes must satisfy 0 ≤ start < end ≤ 1440");
    const validFrom = r.validFrom ?? null;
    const validTo = r.validTo ?? null;
    if ((validFrom !== null && !isIsoDate(validFrom)) || (validTo !== null && !isIsoDate(validTo))) bad("availability validity must be YYYY-MM-DD");
    return { weekday: weekday as Weekday, startMinute: r.startMinute, endMinute: r.endMinute, validFrom, validTo };
  });
  const key = (r: AvailabilityRule) => `${r.weekday}|${String(r.startMinute).padStart(4, "0")}|${String(r.endMinute).padStart(4, "0")}|${r.validFrom ?? ""}|${r.validTo ?? ""}`;
  const seen = new Map<string, AvailabilityRule>();
  for (const r of out) seen.set(key(r), r);
  return [...seen.entries()].sort((a, b) => cmp(a[0], b[0])).map(([, r]) => r);
}

function compat(c: readonly CompatAnswer[] | null | undefined, on: boolean, questions: readonly QuestionnaireQuestion[]): CompatAnswer[] | null {
  if (!on || c === null || c === undefined) return null;
  const ids = new Set(questions.map((q) => q.id));
  const out = new Map<string, number>();
  for (const a of arr(c, "compat")) {
    const id = str(a.questionId, "compat.questionId");
    if (!ids.has(id)) continue; // answers to unconfigured questions are never read
    if (typeof a.value !== "number" || !Number.isFinite(a.value)) bad("compat value must be a finite number");
    if (out.has(id)) bad(`duplicate compat answer for ${id}`);
    out.set(id, a.value);
  }
  return [...out].map(([questionId, value]) => ({ questionId, value })).sort((a, b) => cmp(a.questionId, b.questionId));
}

function member(m: MemberInput, n: Needs, questions: readonly QuestionnaireQuestion[]): MemberInput {
  return {
    personId: str(m.personId, "member.personId"),
    eligible: n.eligibility ? bool(m.eligible) : true,
    gradeBucket: n.career ? optNum(m.gradeBucket) : null,
    reporting: reporting(m.reporting, n),
    languages: languages(m.languages, n.language),
    interests: interests(m.interests, n.interests),
    availability: availability(m.availability, n.availability),
    compat: compat(m.compat, n.other, questions),
  };
}

function mentor(m: MentorInput, n: Needs, questions: readonly QuestionnaireQuestion[]): MentorInput {
  const rank: Record<Depth, number> = { working: 0, advanced: 1, expert: 2 };
  const topics = new Map<string, Depth>();
  if (n.topics)
    for (const t of arr(m.topics, "mentor.topics") as readonly TopicOffer[]) {
      const id = str(t.tagId, "topic.tagId");
      const d: Depth = t.depth === "expert" || t.depth === "advanced" ? t.depth : "working";
      const prev = topics.get(id);
      if (prev === undefined || rank[d] > rank[prev]) topics.set(id, d);
    }
  const cap = optNum(m.capacity);
  const load = optNum(m.load);
  if (cap === null || load === null || cap < 0 || load < 0) bad("mentor capacity and load must be non-negative numbers");
  return {
    personId: str(m.personId, "mentor.personId"),
    organisationId: str(m.organisationId, "mentor.organisationId"),
    approved: bool(m.approved),
    eligible: n.eligibility ? bool(m.eligible) : true,
    minimumProfile: bool(m.minimumProfile),
    browsableWithoutMinimumProfile: bool(m.browsableWithoutMinimumProfile),
    capacity: cap as number,
    load: load as number,
    topics: [...topics].map(([tagId, depth]) => ({ tagId, depth })).sort((a, b) => cmp(a.tagId, b.tagId)),
    phases: n.phases ? uniqSorted(arr(m.phases, "mentor.phases").filter((p) => p === "develop" || p === "design" || p === "test")) as MentorInput["phases"] : [],
    gradeBucket: n.career ? optNum(m.gradeBucket) : null,
    reporting: reporting(m.reporting, n),
    languages: languages(m.languages, n.language),
    interests: interests(m.interests, n.interests),
    availability: availability(m.availability, n.availability),
    compat: compat(m.compat, n.other, questions),
    visible: {
      topics: bool(m.visible?.topics),
      availability: bool(m.visible?.availability),
      languages: bool(m.visible?.languages),
      interests: bool(m.visible?.interests),
      questionnaire: bool(m.visible?.questionnaire),
    },
  };
}

function seeker(s: SeekerInput, n: Needs, questions: readonly QuestionnaireQuestion[]): SeekerInput {
  const id = str(s.id, "seeker.id");
  const kind = s.kind === "team" ? "team" : s.kind === "mentee" ? "mentee" : bad(`seeker ${id}: kind must be mentee or team`);
  const members = arr(s.members, `seeker ${id} members`).map((m) => member(m, n, questions)).sort((a, b) => cmp(a.personId, b.personId));
  if (members.length === 0) bad(`seeker ${id} has no members`);
  if (new Set(members.map((m) => m.personId)).size !== members.length) bad(`seeker ${id} has duplicate members`);
  const lead = str(s.leadPersonId, "seeker.leadPersonId");
  if (!members.some((m) => m.personId === lead)) bad(`seeker ${id}: lead is not a member`);
  if (kind === "mentee" && (members.length !== 1 || members[0]!.personId !== id)) bad(`seeker ${id}: a mentee seeker has exactly one member, the mentee`);

  const goals: SeekerGoal[] = [];
  const phase = n.topics && n.phases && kind === "team" && (s.phase === "develop" || s.phase === "design" || s.phase === "test") ? s.phase : null;
  if (n.topics && kind === "mentee") {
    const seen = new Set<string>();
    for (const g of arr(s.goals ?? [], `seeker ${id} goals`)) {
      const gid = str(g.id, "goal.id");
      if (seen.has(gid)) bad(`seeker ${id}: duplicate goal ${gid}`);
      seen.add(gid);
      const title = typeof g.sharedTitle === "string" && g.sharedTitle.length > 0 ? g.sharedTitle : null;
      goals.push({ id: gid, primary: bool(g.primary), tags: uniqSorted(arr(g.tags ?? [], "goal.tags").map((t) => str(t, "tag"))), sharedTitle: title });
    }
    // First goal = a primary goal, then by id (input order must not matter, MT-P3).
    goals.sort((a, b) => (a.primary === b.primary ? cmp(a.id, b.id) : a.primary ? -1 : 1));
  }
  return {
    id,
    kind,
    organisationId: str(s.organisationId, "seeker.organisationId"),
    members,
    leadPersonId: lead,
    goals,
    neededExpertise: n.topics && kind === "team" ? uniqSorted(arr(s.neededExpertise ?? [], "neededExpertise").map((t) => str(t, "tag"))) : [],
    phase,
    acceptedMatches: n.alreadyMatched ? Math.max(0, Math.trunc(optNum(s.acceptedMatches) ?? 0)) : 0,
    pendingMatches: n.alreadyMatched ? Math.max(0, Math.trunc(optNum(s.pendingMatches) ?? 0)) : 0,
  };
}

function taxonomy(t: readonly TaxonomyTag[], n: Needs): TaxonomyTag[] {
  if (!n.topics) return [];
  const ids = new Set<string>();
  const out = arr(t, "taxonomy").map((x): TaxonomyTag => {
    const id = str(x.id, "taxonomy.id");
    if (ids.has(id)) bad(`duplicate taxonomy tag ${id}`);
    ids.add(id);
    return { id, parentId: x.parentId ? str(x.parentId, "taxonomy.parentId") : null, canonicalId: x.canonicalId ? str(x.canonicalId, "taxonomy.canonicalId") : null, labels: labels(x.labels, `taxonomy ${id} labels`) };
  });
  return out.sort((a, b) => cmp(a.id, b.id));
}

function interestCatalogue(c: readonly InterestTag[], n: Needs): InterestTag[] {
  if (!n.interests) return [];
  const ids = new Set<string>();
  return arr(c, "interestCatalogue")
    .map((x): InterestTag => {
      const id = str(x.id, "interest.id");
      if (ids.has(id)) bad(`duplicate interest ${id}`);
      ids.add(id);
      return { id, labels: labels(x.labels, `interest ${id} labels`) };
    })
    .sort((a, b) => cmp(a.id, b.id));
}

function questions(q: readonly QuestionnaireQuestion[], n: Needs): QuestionnaireQuestion[] {
  if (!n.other) return [];
  const ids = new Set<string>();
  return arr(q, "questionnaire")
    .map((x): QuestionnaireQuestion => {
      const id = str(x.id, "question.id");
      if (ids.has(id)) bad(`duplicate question ${id}`);
      ids.add(id);
      const section = x.section === "field" || x.section === "experience" ? x.section : "character";
      const mode = x.mode === "complementary" ? "complementary" : "similar";
      if (typeof x.scaleMin !== "number" || typeof x.scaleMax !== "number" || !(x.scaleMax > x.scaleMin)) bad(`question ${id}: scaleMax must exceed scaleMin`);
      return { id, section, mode, scaleMin: x.scaleMin, scaleMax: x.scaleMax };
    })
    .sort((a, b) => cmp(a.id, b.id));
}

function blocks(b: readonly BlockEntry[]): BlockEntry[] {
  const seen = new Map<string, BlockEntry>();
  for (const x of arr(b, "blocks")) seen.set(`${x.blockerId}\u0000${x.blockedId}`, { blockerId: str(x.blockerId, "block.blockerId"), blockedId: str(x.blockedId, "block.blockedId") });
  return [...seen.entries()].sort((a, c) => cmp(a[0], c[0])).map(([, v]) => v);
}

function history(h: readonly PairHistoryEntry[], n: Needs): PairHistoryEntry[] {
  const seen = new Map<string, PairHistoryEntry>();
  for (const x of arr(h, "history")) {
    const keep = x.kind === "rematch_previous" || (x.kind === "incompatible" && n.incompatible) || (x.kind === "declined" && n.declined);
    if (!keep) continue;
    if (x.kind === "declined" && !isIsoDate(x.on)) bad("a declined history entry needs a valid date");
    const on = x.kind === "declined" ? (x.on as IsoDate) : null;
    const e: PairHistoryEntry = { seekerId: str(x.seekerId, "history.seekerId"), mentorId: str(x.mentorId, "history.mentorId"), kind: x.kind, on };
    seen.set(`${e.seekerId}\u0000${e.mentorId}\u0000${e.kind}\u0000${on ?? ""}`, e);
  }
  return [...seen.entries()].sort((a, c) => cmp(a[0], c[0])).map(([, v]) => v);
}

function overrides(o: readonly ExclusionOverride[], s: MatchingSettings): ExclusionOverride[] {
  const seen = new Map<string, ExclusionOverride>();
  for (const x of arr(o, "overrides")) {
    const code = x.code as ExclusionCode;
    if (isLocked(code)) continue; // "Never" exclusions cannot be overridden (FR-MAT-002)
    if (s.exclusions[code] !== true && !(code === "INCOMPATIBLE_HISTORY")) continue; // an override of a switched-off exclusion has no effect
    seen.set(`${x.seekerId}\u0000${x.mentorId}\u0000${code}`, { seekerId: str(x.seekerId, "override.seekerId"), mentorId: str(x.mentorId, "override.mentorId"), code });
  }
  return [...seen.entries()].sort((a, c) => cmp(a[0], c[0])).map(([, v]) => v);
}

export function canonicalise(raw: MatchingSnapshot, settings: MatchingSettings): MatchingSnapshot {
  const n = needsOf(settings);
  const organisationId = str(raw.organisationId, "organisationId");
  if (!isIsoDate(raw.programme?.asOf)) bad("programme.asOf must be a valid YYYY-MM-DD date");
  const type = raw.programme.type;
  if (type !== "open" && type !== "leadership" && type !== "sparklab") bad("programme.type invalid");
  const qs = questions(raw.questionnaire ?? [], n);
  const seekers = arr(raw.seekers, "seekers").map((s) => seeker(s, n, qs)).sort((a, b) => cmp(a.id, b.id));
  const mentors = arr(raw.mentors, "mentors").map((m) => mentor(m, n, qs)).sort((a, b) => cmp(a.personId, b.personId));
  if (new Set(seekers.map((s) => s.id)).size !== seekers.length) bad("duplicate seeker id");
  if (new Set(mentors.map((m) => m.personId)).size !== mentors.length) bad("duplicate mentor id");
  return {
    organisationId,
    programme: { id: str(raw.programme.id, "programme.id"), type, asOf: raw.programme.asOf },
    taxonomy: taxonomy(raw.taxonomy ?? [], n),
    interestCatalogue: interestCatalogue(raw.interestCatalogue ?? [], n),
    questionnaire: qs,
    seekers,
    mentors,
    blocks: blocks(raw.blocks ?? []),
    history: history(raw.history ?? [], n),
    overrides: overrides(raw.overrides ?? [], settings),
  };
}
