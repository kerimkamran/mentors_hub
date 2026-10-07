import fc from "fast-check";
import { defaultMatchingSettings } from "@/domain/matching/settings";
import type {
  AvailabilityRule,
  CompatAnswer,
  Depth,
  ExclusionCode,
  LanguageSkill,
  MatchingSettings,
  MatchingSnapshot,
  MemberInput,
  MentorInput,
  ProgrammeType,
  QuestionnaireQuestion,
  SeekerGoal,
  SeekerInput,
} from "@/domain/matching/types";
import { AS_OF, INTERESTS, ORG, TAXONOMY } from "./fixtures";

/** fast-check generators for MT-P1 … MT-P12. Persons p0–p5 can be seekers and mentors at once (SAME_PERSON), mentors use p3–p9. */

const TAGS = TAXONOMY.map((t) => t.id);
const LANGS = ["az", "en", "ru", "tr"];
const PERSONS = Array.from({ length: 10 }, (_, i) => `p${i}`);

const arbDepth: fc.Arbitrary<Depth> = fc.constantFrom("working", "advanced", "expert");
const arbReporting = fc.record({ managerId: fc.option(fc.constantFrom(...PERSONS, "boss1", "boss2"), { nil: null }), skipLevelId: fc.option(fc.constantFrom(...PERSONS, "boss1", "boss2"), { nil: null }) });
const arbLanguages: fc.Arbitrary<LanguageSkill[] | null> = fc.option(
  fc.uniqueArray(fc.constantFrom(...LANGS), { maxLength: 3 }).chain((ls) => fc.tuple(...ls.map(() => fc.constantFrom<"working" | "fluent">("working", "fluent"))).map((lv) => ls.map((language, i) => ({ language, level: lv[i]! })))),
  { nil: null },
);
const arbRule: fc.Arbitrary<AvailabilityRule> = fc
  .record({ weekday: fc.integer({ min: 1, max: 7 }), start: fc.integer({ min: 0, max: 22 }), len: fc.integer({ min: 1, max: 6 }), from: fc.option(fc.constantFrom("2026-09-01", "2026-10-12"), { nil: null }), to: fc.option(fc.constantFrom("2026-10-20", "2027-01-01"), { nil: null }) })
  .map((r) => ({ weekday: r.weekday as AvailabilityRule["weekday"], startMinute: r.start * 60, endMinute: Math.min(1440, (r.start + r.len) * 60), validFrom: r.from, validTo: r.to }));
const arbAvailability: fc.Arbitrary<AvailabilityRule[] | null> = fc.option(fc.array(arbRule, { maxLength: 4 }), { nil: null });
const arbInterests = fc.option(fc.uniqueArray(fc.constantFrom(...INTERESTS.map((i) => i.id)), { maxLength: 3 }), { nil: null });

export const QUESTIONS: QuestionnaireQuestion[] = [
  { id: "q1", section: "character", mode: "similar", scaleMin: 1, scaleMax: 5 },
  { id: "q2", section: "field", mode: "complementary", scaleMin: 1, scaleMax: 5 },
  { id: "q3", section: "experience", mode: "similar", scaleMin: 1, scaleMax: 5 },
];
const arbCompat: fc.Arbitrary<CompatAnswer[] | null> = fc.option(
  fc.uniqueArray(fc.constantFrom("q1", "q2", "q3"), { maxLength: 3 }).chain((ids) => fc.tuple(...ids.map(() => fc.integer({ min: 1, max: 5 }))).map((vs) => ids.map((questionId, i) => ({ questionId, value: vs[i]! })))),
  { nil: null },
);

const arbMember = (personId: string): fc.Arbitrary<MemberInput> =>
  fc.record({
    personId: fc.constant(personId),
    eligible: fc.constantFrom(true, true, true, false),
    gradeBucket: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
    reporting: arbReporting,
    languages: arbLanguages,
    interests: arbInterests,
    availability: arbAvailability,
    compat: arbCompat,
  });

const arbGoal = (id: string): fc.Arbitrary<SeekerGoal> =>
  fc.record({ id: fc.constant(id), primary: fc.boolean(), tags: fc.uniqueArray(fc.constantFrom(...TAGS), { maxLength: 3 }), sharedTitle: fc.option(fc.constantFrom("Grow into a director role", "Learn forecasting"), { nil: undefined }) });

export const arbSeeker = (id: string, allowTeam: boolean): fc.Arbitrary<SeekerInput> => {
  const mentee = fc.record({
    id: fc.constant(id),
    kind: fc.constant<"mentee">("mentee"),
    organisationId: fc.constant(ORG),
    members: arbMember(id).map((m) => [m]),
    leadPersonId: fc.constant(id),
    goals: fc.tuple(arbGoal(`${id}-g1`), arbGoal(`${id}-g2`), fc.integer({ min: 0, max: 2 })).map(([a, b, n]) => [a, b].slice(0, n)),
    neededExpertise: fc.constant<string[]>([]),
    phase: fc.constant(null),
    acceptedMatches: fc.constantFrom(0, 0, 0, 1),
    pendingMatches: fc.constantFrom(0, 0, 0, 1, 2),
  });
  if (!allowTeam) return mentee;
  const team = fc.integer({ min: 2, max: 5 }).chain((n) => {
    const ids = Array.from({ length: n }, (_, i) => `${id}-m${i}`);
    return fc.record({
      id: fc.constant(id),
      kind: fc.constant<"team">("team"),
      organisationId: fc.constant(ORG),
      members: fc.tuple(...ids.map((m) => arbMember(m))).map((x) => x as MemberInput[]),
      leadPersonId: fc.constant(ids[0]!),
      goals: fc.constant<SeekerGoal[]>([]),
      neededExpertise: fc.uniqueArray(fc.constantFrom(...TAGS), { maxLength: 3 }),
      phase: fc.constantFrom<"develop" | "design" | "test" | null>("develop", "design", "test", null),
      acceptedMatches: fc.constantFrom(0, 0, 0, 1),
      pendingMatches: fc.constantFrom(0, 0, 1),
    });
  });
  return fc.oneof(mentee, team);
};

export const arbMentor = (id: string): fc.Arbitrary<MentorInput> =>
  fc.record({
    personId: fc.constant(id),
    organisationId: fc.constantFrom(ORG, ORG, ORG, ORG, ORG, ORG, "org-other"),
    approved: fc.constantFrom(true, true, true, false),
    eligible: fc.constantFrom(true, true, true, false),
    minimumProfile: fc.constantFrom(true, true, true, false),
    browsableWithoutMinimumProfile: fc.boolean(),
    capacity: fc.integer({ min: 0, max: 3 }),
    load: fc.integer({ min: 0, max: 3 }),
    topics: fc.uniqueArray(fc.constantFrom(...TAGS), { maxLength: 4 }).chain((ts) => fc.tuple(...ts.map(() => arbDepth)).map((ds) => ts.map((tagId, i) => ({ tagId, depth: ds[i]! })))),
    phases: fc.uniqueArray(fc.constantFrom<"develop" | "design" | "test">("develop", "design", "test"), { maxLength: 3 }),
    gradeBucket: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
    reporting: arbReporting,
    languages: arbLanguages,
    interests: arbInterests,
    availability: arbAvailability,
    compat: arbCompat,
    visible: fc.record({ topics: fc.boolean(), availability: fc.boolean(), languages: fc.boolean(), interests: fc.boolean(), questionnaire: fc.boolean() }),
  });

export const OVERRIDABLE: ExclusionCode[] = ["ELIGIBILITY", "INCOMPATIBLE_HISTORY", "DECLINED_RECENTLY", "REPORTING_LINE", "REPORTING_PEER", "MENTOR_JUNIOR", "NO_LANGUAGE", "NO_AVAILABILITY", "CAPACITY_FULL", "ALREADY_MATCHED"];

export function arbSettings(type: ProgrammeType): fc.Arbitrary<MatchingSettings> {
  const weights = fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 6, maxLength: 6 }).map((cuts) => {
    const s = [0, ...[...cuts].sort((a, b) => a - b), 100];
    const d = s.slice(1).map((x, i) => x - s[i]!);
    return { goal: d[0]!, expertise: d[1]!, availability: d[2]!, career: d[3]!, language: d[4]!, interests: d[5]!, other: d[6]! };
  });
  return fc
    .record({
      weights,
      depth: fc.tuple(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 })).map((t) => t.sort((a, b) => a - b).map((x) => x / 100)),
      primary: fc.integer({ min: 1, max: 5 }),
      partial: fc.constantFrom(0, 0.25, 0.5, 1),
      sat: fc.integer({ min: 1, max: 7 }),
      lang: fc.tuple(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 })).map((t) => t.sort((a, b) => b - a).map((x) => x / 100)),
      neutral: fc.integer({ min: 0, max: 100 }).map((x) => x / 100),
      threshold: fc.integer({ min: 1, max: 100 }).map((x) => x / 100),
      cutoff: fc.integer({ min: 1, max: 100 }).map((x) => x / 100),
      switches: fc.tuple(...OVERRIDABLE.map(() => fc.boolean())),
      weeks: fc.integer({ min: 1, max: 12 }),
    })
    .map((r) => {
      const s = defaultMatchingSettings(type, "gen-v1");
      s.weights = r.weights;
      s.depthFactors = { working: r.depth[0]!, advanced: r.depth[1]!, expert: r.depth[2]! };
      s.primaryGoalMultiplier = r.primary;
      s.taxonomyPartialCredit = r.partial;
      s.availabilitySaturationDays = r.sat;
      s.languageScores = { fluent: r.lang[0]!, working: r.lang[1]! };
      s.neutralScore = r.neutral;
      s.reasonThreshold = r.threshold;
      s.commonReasonCutoff = r.cutoff;
      OVERRIDABLE.forEach((c, i) => (s.exclusions[c] = r.switches[i]!));
      s.availabilityHorizonWeeks = r.weeks;
      return s;
    });
}

export function arbSnapshot(type: ProgrammeType): fc.Arbitrary<MatchingSnapshot> {
  return fc
    .record({
      seekerCount: fc.integer({ min: 1, max: 4 }),
      mentorCount: fc.integer({ min: 1, max: 6 }),
    })
    .chain(({ seekerCount, mentorCount }) => {
      const seekerIds = PERSONS.slice(0, seekerCount);
      const mentorIds = PERSONS.slice(2, 2 + mentorCount);
      return fc.record({
        seekers: fc.tuple(...seekerIds.map((id) => arbSeeker(id, type === "sparklab"))),
        mentors: fc.tuple(...mentorIds.map((id) => arbMentor(id))),
        blocks: fc.array(fc.record({ blockerId: fc.constantFrom(...PERSONS), blockedId: fc.constantFrom(...PERSONS) }), { maxLength: 3 }),
        history: fc.array(
          fc.record({
            seekerId: fc.constantFrom(...seekerIds),
            mentorId: fc.constantFrom(...mentorIds),
            kind: fc.constantFrom<"incompatible" | "declined" | "rematch_previous">("incompatible", "declined", "rematch_previous"),
            on: fc.constantFrom<string | null>("2026-07-01", "2026-09-01", "2026-10-01"),
          }),
          { maxLength: 3 },
        ),
        overrides: fc.array(fc.record({ seekerId: fc.constantFrom(...seekerIds), mentorId: fc.constantFrom(...mentorIds), code: fc.constantFrom<ExclusionCode>(...OVERRIDABLE, "BLOCKED", "SAME_PERSON") }), { maxLength: 4 }),
        useQuestions: fc.boolean(),
      });
    })
    .map((r) => ({
      organisationId: ORG,
      programme: { id: `prog-${type}`, type, asOf: AS_OF },
      taxonomy: TAXONOMY,
      interestCatalogue: INTERESTS,
      questionnaire: r.useQuestions ? QUESTIONS : [],
      seekers: r.seekers as SeekerInput[],
      mentors: r.mentors as MentorInput[],
      blocks: r.blocks,
      history: r.history.map((h) => ({ ...h, on: h.kind === "declined" ? h.on : null })),
      overrides: r.overrides,
    }));
}

/* ---- deterministic helpers for mutation / shuffling inside property tests (test-only randomness, seeded) ---- */

export function lcg(seed: number): () => number {
  let x = (seed >>> 0) || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

export function shuffled<T>(xs: readonly T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Recursively shuffles every array in a value. */
export function shuffleDeep<T>(v: T, rnd: () => number): T {
  if (Array.isArray(v)) return shuffled(v.map((x) => shuffleDeep(x, rnd)), rnd) as unknown as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shuffleDeep(x, rnd)])) as T;
  return v;
}
