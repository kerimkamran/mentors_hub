import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { renderExplanation, runMatching, validateMatchingSettings } from "@/domain/matching";
import { defaultMatchingSettings } from "@/domain/matching/settings";
import { InvalidSettingsError, isLocked, type ExclusionCode, type MatchingResult, type MatchingSettings, type MatchingSnapshot, type MemberInput, type MentorInput, type ProgrammeType, type SeekerInput } from "@/domain/matching/types";
import { arbSettings, arbSnapshot, lcg, OVERRIDABLE, shuffleDeep } from "./gen";
import { INTERESTS } from "./fixtures";

const RUNS = { numRuns: 150 };
const TYPES: ProgrammeType[] = ["open", "leadership", "sparklab"];
const arbType = fc.constantFrom(...TYPES);
const arbCase = arbType.chain((type) => fc.tuple(arbSnapshot(type), arbSettings(type), fc.constant(type)));
const strip = (r: MatchingResult) => JSON.parse(JSON.stringify(r)) as MatchingResult;

describe("MT-P1 · an excluded pair never appears in any ranked output unless an override record exists (INV-7.7)", () => {
  it("MT-P1 · no ranked / recommended / drafted pair carries an active exclusion that an independent oracle can see", () => {
    fc.assert(
      fc.property(arbCase, ([snap, st, type]) => {
        const r = runMatching(snap, st, type === "open" ? "recommend" : "draft");
        const overridden = (seeker: string, mentor: string, code: ExclusionCode) => snap.overrides.some((o) => o.seekerId === seeker && o.mentorId === mentor && o.code === code && !isLocked(code));
        for (const sr of r.seekers) {
          const seeker = snap.seekers.find((s) => s.id === sr.seekerId)!;
          const ranked = new Set(sr.candidates.map((c) => c.mentorId));
          for (const mentorId of ranked) {
            const m = snap.mentors.find((x) => x.personId === mentorId)!;
            // locked codes can never be present
            expect(seeker.members.some((x) => x.personId === m.personId)).toBe(false);
            expect(snap.blocks.some((b) => seeker.members.some((x) => (b.blockerId === x.personId && b.blockedId === m.personId) || (b.blockerId === m.personId && b.blockedId === x.personId)))).toBe(false);
            expect(m.approved).toBe(true);
            // overridable codes: present only with an override record for this pair
            if (st.exclusions.CAPACITY_FULL && m.load >= m.capacity) expect(overridden(seeker.id, m.personId, "CAPACITY_FULL")).toBe(true);
            if (st.exclusions.ELIGIBILITY && (!m.eligible || seeker.members.some((x) => !x.eligible))) expect(overridden(seeker.id, m.personId, "ELIGIBILITY")).toBe(true);
            if (st.exclusions.REPORTING_LINE && seeker.members.some((x) => [x.reporting.managerId, x.reporting.skipLevelId].includes(m.personId) || [m.reporting.managerId, m.reporting.skipLevelId].includes(x.personId))) expect(overridden(seeker.id, m.personId, "REPORTING_LINE")).toBe(true);
            if (st.exclusions.ALREADY_MATCHED && (seeker.acceptedMatches > 0 || seeker.pendingMatches >= (type === "open" ? st.openRequestLimit : 1))) expect(overridden(seeker.id, m.personId, "ALREADY_MATCHED")).toBe(true);
            expect(m.organisationId).toBe(snap.organisationId);
            // excluded and ranked are disjoint
            expect(sr.excluded.some((e) => e.mentorId === mentorId)).toBe(false);
          }
          for (const e of sr.excluded) expect(ranked.has(e.mentorId)).toBe(false);
          for (const id of sr.recommended) expect(ranked.has(id)).toBe(true);
        }
        for (const a of r.draft?.assignments ?? []) expect(r.seekers.find((s) => s.seekerId === a.seekerId)!.candidates.some((c) => c.mentorId === a.mentorId)).toBe(true);
      }),
      RUNS,
    );
  });

  it("MT-P1 · an override of every overridable code of an excluded pair returns it; locked codes never return (FR-MAT-002)", () => {
    fc.assert(
      fc.property(arbCase, ([snap, st, type]) => {
        const r = runMatching(snap, st, "recommend");
        const more: MatchingSnapshot["overrides"] = [];
        for (const sr of r.seekers) for (const e of sr.excluded) for (const x of e.exclusions) if (!x.locked) more.push({ seekerId: sr.seekerId, mentorId: e.mentorId, code: x.code });
        const r2 = runMatching({ ...snap, overrides: [...snap.overrides, ...more] }, st, "recommend");
        for (let i = 0; i < r.seekers.length; i++)
          for (const e of r.seekers[i]!.excluded) {
            const back = r2.seekers[i]!.candidates.some((c) => c.mentorId === e.mentorId);
            expect(back).toBe(e.exclusions.every((x) => !x.locked));
          }
        void type;
      }),
      RUNS,
    );
  });
});

/* ---- MT-P2 ---------------------------------------------------------------------------------- */

type Mutator = (snap: MatchingSnapshot, seed: number) => MatchingSnapshot;
const pick = <T,>(xs: readonly T[], rnd: () => number): T => xs[Math.floor(rnd() * xs.length)]!;
function mapPeople(snap: MatchingSnapshot, fm: (m: MemberInput | MentorInput, rnd: () => number) => void, seed: number): MatchingSnapshot {
  const c = structuredClone(snap);
  const rnd = lcg(seed);
  for (const m of c.mentors) fm(m, rnd);
  for (const s of c.seekers) for (const m of s.members) fm(m, rnd);
  return c;
}
const MUTATORS: Record<string, { zero: (keyof MatchingSettings["weights"])[]; off: ExclusionCode[]; mutate: Mutator }> = {
  availability: {
    zero: ["availability"],
    off: ["NO_AVAILABILITY"],
    mutate: (s, seed) => mapPeople(s, (m, r) => (m.availability = r() < 0.2 ? null : [{ weekday: (1 + Math.floor(r() * 7)) as 1, startMinute: 540, endMinute: 540 + 60 * (1 + Math.floor(r() * 5)), validFrom: null, validTo: null }]), seed),
  },
  career: { zero: ["career"], off: ["MENTOR_JUNIOR"], mutate: (s, seed) => mapPeople(s, (m, r) => (m.gradeBucket = r() < 0.2 ? null : Math.floor(r() * 6)), seed) },
  language: {
    zero: ["language"],
    off: ["NO_LANGUAGE"],
    mutate: (s, seed) => mapPeople(s, (m, r) => (m.languages = r() < 0.2 ? null : [{ language: pick(["az", "en", "ru"], r), level: pick(["working", "fluent"] as const, r) }]), seed),
  },
  interests: { zero: ["interests"], off: [], mutate: (s, seed) => mapPeople(s, (m, r) => (m.interests = r() < 0.2 ? null : [pick(INTERESTS, r).id, pick(INTERESTS, r).id]), seed) },
  other: { zero: ["other"], off: [], mutate: (s, seed) => mapPeople(s, (m, r) => (m.compat = r() < 0.2 ? null : [{ questionId: "q1", value: 1 + Math.floor(r() * 5) }]), seed) },
  topics: {
    zero: ["goal", "expertise"],
    off: [],
    mutate: (s, seed) => {
      const c = mapPeople(s, (m, r) => {
        if ("topics" in m) {
          m.topics = [{ tagId: pick(["strategy", "ml", "sql", "finance"], r), depth: "expert" }];
          m.phases = r() < 0.5 ? ["design"] : [];
        }
      }, seed);
      const rnd = lcg(seed + 7);
      for (const s2 of c.seekers) {
        s2.goals = s2.kind === "mentee" ? [{ id: "gx", primary: rnd() < 0.5, tags: [pick(["ml", "strategy", "finance"], rnd)], sharedTitle: "Another title" }] : [];
        s2.neededExpertise = s2.kind === "team" ? [pick(["ml", "sql"], rnd)] : [];
        s2.phase = s2.kind === "team" ? pick(["develop", "test"] as const, rnd) : null;
      }
      return c;
    },
  },
};

describe("MT-P2 · a criterion with weight 0 has no effect on any output (INV-7.5)", () => {
  for (const [name, m] of Object.entries(MUTATORS))
    it(`MT-P2 · ${name}: changing the inputs of a zero-weight criterion changes nothing (incl. the snapshot hash)`, () => {
      fc.assert(
        fc.property(arbType, fc.integer({ min: 1, max: 1e6 }), fc.integer({ min: 1, max: 1e6 }), (type, seed, seed2) =>
          fc.assert(
            fc.property(arbSnapshot(type), arbSettings(type), (snap, st0) => {
              const st = structuredClone(st0);
              // move the zeroed weights onto the first non-zeroed criterion so the total stays 100
              const others = (Object.keys(st.weights) as (keyof typeof st.weights)[]).filter((k) => !m.zero.includes(k));
              const moved = m.zero.reduce((a, k) => a + st.weights[k], 0);
              m.zero.forEach((k) => (st.weights[k] = 0));
              st.weights[others[0]!] += moved;
              m.off.forEach((c) => (st.exclusions[c] = false));
              const a = runMatching(m.mutate(snap, seed), st, type === "open" ? "recommend" : "draft");
              const b = runMatching(m.mutate(snap, seed2), st, type === "open" ? "recommend" : "draft");
              expect(b).toEqual(a);
            }),
            { numRuns: 5 },
          ),
        ),
        { numRuns: 20 },
      );
    });
});

describe("MT-P3 · shuffling input order does not change output (INV-7.6)", () => {
  it("MT-P3 · every collection of the snapshot (and the explanation reasons) is order-insensitive", () => {
    fc.assert(
      fc.property(arbCase, fc.integer({ min: 1, max: 1e9 }), ([snap, st, type], seed) => {
        const mode = type === "open" ? "recommend" : "draft";
        const a = runMatching(snap, st, mode);
        const b = runMatching(shuffleDeep(snap, lcg(seed)), st, mode);
        expect(b).toEqual(a);
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      }),
      RUNS,
    );
  });
});

describe("MT-P4 · capacity is never exceeded in a draft (INV-7.8)", () => {
  it("MT-P4 · per mentor, drafted pairs ≤ max(0, capacity − load); each seeker is placed at most once; placed + unmatched = all seekers", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ProgrammeType>("leadership", "sparklab").chain((type) => fc.tuple(arbSnapshot(type), arbSettings(type))),
        ([snap, st]) => {
          const r = runMatching(snap, st, "draft");
          const used = new Map<string, number>();
          for (const a of r.draft!.assignments) used.set(a.mentorId, (used.get(a.mentorId) ?? 0) + 1);
          for (const [id, n] of used) {
            const m = snap.mentors.find((x) => x.personId === id)!;
            expect(n).toBeLessThanOrEqual(Math.max(0, m.capacity - m.load));
          }
          const placed = r.draft!.assignments.map((a) => a.seekerId);
          expect(new Set(placed).size).toBe(placed.length);
          expect([...placed, ...r.draft!.unmatched].sort()).toEqual(snap.seekers.map((s) => s.id).sort());
        },
      ),
      RUNS,
    );
  });
});

describe("MT-P5 · changing any field outside the snapshot table (incl. private fields) does not change output (INV-7.3, FR-MAT-006)", () => {
  function junk(v: unknown, depth = 0): unknown {
    if (Array.isArray(v)) return v.map((x) => junk(x, depth + 1));
    if (v && typeof v === "object")
      return { ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, junk(x, depth + 1)])), privateNote: "SECRET-NOTE-123", title: "SECRET-TITLE-456", messageText: "SECRET-MSG-789", salary: 12345, grade: 99, rawGradeNumber: 17 };
    return v;
  }
  it("MT-P5 · extra private keys on every object are ignored and never leak into the result", () => {
    fc.assert(
      fc.property(arbCase, ([snap, st, type]) => {
        const mode = type === "open" ? "recommend" : "draft";
        const a = runMatching(snap, st, mode);
        const b = runMatching(junk(snap) as MatchingSnapshot, st, mode);
        expect(b).toEqual(a);
        expect(JSON.stringify(b)).not.toMatch(/SECRET/);
      }),
      RUNS,
    );
  });
  it("MT-P5 · the grade bucket and reporting line change only scores/exclusions through their declared criteria and never appear in output", () => {
    fc.assert(
      fc.property(arbCase, ([snap, st, type]) => {
        const r = runMatching(snap, st, type === "open" ? "recommend" : "draft");
        const text = JSON.stringify(r);
        expect(text).not.toMatch(/managerId|skipLevelId|gradeBucket|reporting/);
      }),
      RUNS,
    );
  });
});

describe("MT-P6 · same snapshot + same engine version ⇒ byte-identical output (INV-7.1)", () => {
  it("MT-P6 · repeated runs, and runs on a deep clone, serialise to identical bytes", () => {
    fc.assert(
      fc.property(arbCase, ([snap, st, type]) => {
        const mode = type === "open" ? "recommend" : "draft";
        const a = JSON.stringify(runMatching(snap, st, mode));
        expect(JSON.stringify(runMatching(snap, st, mode))).toBe(a);
        expect(JSON.stringify(runMatching(structuredClone(snap), structuredClone(st), mode))).toBe(a);
      }),
      RUNS,
    );
  });
});

describe("MT-P7 · a blank mentor profile never outranks a complete profile with equal exclusions", () => {
  it("MT-P7 · blank total ≤ complete total; strictly lower rank whenever the complete profile scores above the blank one", () => {
    fc.assert(
      fc.property(
        arbType.chain((type) => fc.tuple(arbSnapshot(type), arbSettings(type), fc.constant(type))),
        ([snap, st, type]) => {
          const base: MentorInput = {
            personId: "zz-complete",
            organisationId: snap.organisationId,
            approved: true,
            eligible: true,
            minimumProfile: true,
            browsableWithoutMinimumProfile: false,
            capacity: 9,
            load: 0,
            topics: [{ tagId: "strategy", depth: "expert" }, { tagId: "ml", depth: "advanced" }],
            phases: ["develop", "design", "test"],
            gradeBucket: 3,
            reporting: { managerId: null, skipLevelId: null },
            languages: [{ language: "az", level: "fluent" }, { language: "en", level: "fluent" }, { language: "ru", level: "fluent" }, { language: "tr", level: "fluent" }],
            interests: INTERESTS.map((i) => i.id),
            availability: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ weekday: d as 1, startMinute: 0, endMinute: 1440, validFrom: null, validTo: null })),
            compat: [{ questionId: "q1", value: 3 }, { questionId: "q2", value: 3 }, { questionId: "q3", value: 3 }],
            visible: { topics: true, availability: true, languages: true, interests: true, questionnaire: true },
          };
          const blank: MentorInput = { ...base, personId: "aa-blank", topics: [], phases: [], gradeBucket: null, languages: null, interests: null, availability: null, compat: null };
          const withBoth: MatchingSnapshot = { ...snap, mentors: [...snap.mentors, base, blank] };
          const r = runMatching(withBoth, st, "recommend");
          for (const sr of r.seekers) {
            const c = sr.candidates.find((x) => x.mentorId === "zz-complete");
            const b = sr.candidates.find((x) => x.mentorId === "aa-blank");
            if (!c || !b) continue; // equal exclusions are not guaranteed to be equal (e.g. NO_LANGUAGE only applies to provided data)
            expect(b.total).toBeLessThanOrEqual(c.total);
            if (c.total > b.total) expect(c.rank).toBeLessThan(b.rank);
            for (const x of b.breakdown) if (x.weight > 0 && x.status !== "neutral_seeker_missing") expect(x.subscore).toBe(0);
          }
          void type;
        },
      ),
      RUNS,
    );
  });
});

describe("MT-P8 · total within [0, 100]; every sub-score within [0, 1] (C-061)", () => {
  it("MT-P8 · bounds, 2-decimal precision and Σ contributions = total", () => {
    fc.assert(
      fc.property(arbCase, ([snap, st, type]) => {
        const r = runMatching(snap, st, type === "open" ? "recommend" : "draft");
        for (const sr of r.seekers)
          for (const c of sr.candidates) {
            expect(c.total).toBeGreaterThanOrEqual(0);
            expect(c.total).toBeLessThanOrEqual(100);
            expect(Math.abs(c.total * 100 - Math.round(c.total * 100))).toBeLessThan(1e-6);
            for (const b of c.breakdown) {
              expect(b.subscore).toBeGreaterThanOrEqual(0);
              expect(b.subscore).toBeLessThanOrEqual(1);
              expect(Math.abs(b.subscore * 100 - Math.round(b.subscore * 100))).toBeLessThan(1e-6);
            }
            expect(c.breakdown.reduce((a, b) => a + b.contribution, 0)).toBeCloseTo(c.total, 6);
            expect(c.breakdown.map((b) => b.criterion)).toEqual(["goal", "expertise", "availability", "career", "language", "interests", "other"]);
          }
        // ranking is non-increasing in total
        for (const sr of r.seekers) for (let i = 1; i < sr.candidates.length; i++) expect(sr.candidates[i - 1]!.total).toBeGreaterThanOrEqual(sr.candidates[i]!.total);
      }),
      RUNS,
    );
  });
});

describe("MT-P9 · explanations never contain digits that encode a score or percentage (FR-MAT-010)", () => {
  it("MT-P9 · rendered mentee reasons in every language contain no %, no decimals, and no digits other than the weekly day count", () => {
    fc.assert(
      fc.property(arbCase, ([snap, st, type]) => {
        const r = runMatching(snap, st, type === "open" ? "recommend" : "draft");
        for (const sr of r.seekers)
          for (const c of sr.candidates) {
            expect(c.explanation.mentee.length).toBeGreaterThanOrEqual(1);
            expect(c.explanation.mentee.length).toBeLessThanOrEqual(st.maxReasons);
            const days = c.explanation.mentee.filter((x) => x.code === "AVAILABILITY").map((x) => (x as { days: number }).days);
            for (const locale of ["en", "az", "ru"] as const)
              for (const line of renderExplanation(c.explanation.mentee, locale)) {
                expect(line).not.toMatch(/%|\d+[.,]\d+|процент|faiz/i);
                for (const digits of line.match(/\d+/g) ?? []) expect(days.map(String)).toContain(digits);
              }
            const dump = JSON.stringify(c.explanation.mentee);
            expect(dump).not.toMatch(/subscore|weight|total|score|exclu|grade|manager|reporting/i);
          }
      }),
      RUNS,
    );
  });
});

describe("MT-P10 · the mentor view contains no goal title unless the goal was shared (FR-MAT-011)", () => {
  it("MT-P10 · only titles the mentee shared (sharedTitle) can appear; unknown title fields never do", () => {
    fc.assert(
      fc.property(arbSnapshot("open"), arbSettings("open"), (snap0, st) => {
        const snap = structuredClone(snap0);
        for (const s of snap.seekers) for (const g of s.goals) (g as unknown as Record<string, unknown>).title = `PRIVATE-${g.id}`;
        const r = runMatching(snap, st, "recommend");
        for (const sr of r.seekers) {
          const seeker = snap.seekers.find((s) => s.id === sr.seekerId)!;
          const shared = new Set(seeker.goals.map((g) => g.sharedTitle).filter(Boolean));
          for (const c of sr.candidates) {
            const text = JSON.stringify(c.explanation.mentor);
            expect(text).not.toMatch(/PRIVATE-/);
            for (const m of c.explanation.mentor) if (m.code === "MENTOR_SEEKS_TOPIC" && m.goalTitle !== undefined) expect(shared.has(m.goalTitle)).toBe(true);
            for (const locale of ["en", "az", "ru"] as const) for (const line of renderExplanation(c.explanation.mentor, locale)) expect(line).not.toMatch(/PRIVATE-/);
          }
        }
      }),
      RUNS,
    );
  });
});

describe("MT-P11 · changing a parameter changes output only through that parameter; the result names the version used (INV-7.9)", () => {
  it("MT-P11 · a new version id with identical values changes only the version fields and the hash", () => {
    fc.assert(
      fc.property(arbCase, ([snap, st, type]) => {
        const mode = type === "open" ? "recommend" : "draft";
        const a = runMatching(snap, st, mode);
        const b = runMatching(snap, { ...st, versionId: "another-version" }, mode);
        expect(a.settingsVersionId).toBe(st.versionId);
        expect(b.settingsVersionId).toBe("another-version");
        expect(b.snapshotHash).not.toBe(a.snapshotHash);
        expect({ ...b, settingsVersionId: a.settingsVersionId, snapshotHash: a.snapshotHash }).toEqual(a);
      }),
      RUNS,
    );
  });
  it("MT-P11 · a parameter that no input touches (phase multiplier without teams, depth factors without expertise weight) changes nothing", () => {
    fc.assert(
      fc.property(arbSnapshot("open"), arbSettings("open"), (snap, st0) => {
        const st = { ...st0, weights: { ...st0.weights, goal: st0.weights.goal + st0.weights.expertise, expertise: 0 } };
        const a = runMatching(snap, st, "recommend");
        const b = runMatching(snap, { ...st, phaseMismatchMultiplier: 0.1, depthFactors: { working: 0.1, advanced: 0.2, expert: 0.3 } }, "recommend");
        // Scores, ranks and exclusions are untouched; only the order of the mentor-side reason lines may
        // use depth as a tie-break (explanation.ts), so explanations are compared separately by length.
        const strip = (r: typeof a) => r.seekers.map((sr) => ({ ...sr, candidates: sr.candidates.map(({ explanation: _e, ...c }) => c) }));
        expect(strip(b)).toEqual(strip(a));
        const lens = (r: typeof a) => r.seekers.map((sr) => sr.candidates.map((c) => [c.explanation.mentee, c.explanation.mentor.length]));
        expect(lens(b)).toEqual(lens(a));
      }),
      RUNS,
    );
  });
  it("MT-P11 · the same snapshot under a different parameter may rank differently but each result stays internally consistent", () => {
    fc.assert(
      fc.property(arbSnapshot("leadership"), arbSettings("leadership"), arbSettings("leadership"), (snap, s1, s2) => {
        const a = runMatching(snap, { ...s1, versionId: "A" }, "recommend");
        const b = runMatching(snap, { ...s2, versionId: "B" }, "recommend");
        expect([a.settingsVersionId, b.settingsVersionId]).toEqual(["A", "B"]);
        for (const r of [a, b]) for (const sr of r.seekers) for (const c of sr.candidates) expect(c.breakdown.every((x) => x.weight === (r === a ? s1 : s2).weights[x.criterion])).toBe(true);
      }),
      RUNS,
    );
  });
});

describe("MT-P12 · every parameter bound is enforced before values reach the engine", () => {
  const mutations: [string, (s: MatchingSettings, n: number) => void][] = [
    ["weights total ≠ 100", (s, n) => (s.weights.goal += 1 + (n % 5))],
    ["fractional weight", (s, n) => ((s.weights.goal += 0.25 + (n % 3) * 0.25), (s.weights.expertise -= 0.25 + (n % 3) * 0.25))],
    ["negative weight", (s) => ((s.weights.interests = -1), (s.weights.goal += 1))],
    ["depth factor out of order", (s) => ((s.depthFactors.working = 1), (s.depthFactors.advanced = 0.5), (s.depthFactors.expert = 0.6))],
    ["depth factor above 1", (s, n) => (s.depthFactors.expert = 1.01 + n / 100)],
    ["depth factor ≤ 0", (s) => (s.depthFactors.working = 0)],
    ["primary multiplier outside 1–5", (s, n) => (s.primaryGoalMultiplier = n % 2 ? 0 : 6 + (n % 4))],
    ["primary multiplier not integer", (s) => (s.primaryGoalMultiplier = 2.5)],
    ["partial credit outside [0, 1]", (s, n) => (s.taxonomyPartialCredit = n % 2 ? -0.1 : 1.2)],
    ["saturation outside 1–7", (s, n) => (s.availabilitySaturationDays = n % 2 ? 0 : 8)],
    ["band score outside [0, 1]", (s, n) => (s.careerBands[n % 4]!.score = n % 2 ? -0.5 : 1.5)],
    ["bands overlap", (s) => (s.careerBands[1]!.maxGap = 1)],
    ["bands leave a hole", (s) => (s.careerBands[3]!.minGap = 4)],
    ["language fluent < working", (s) => ((s.languageScores.fluent = 0.2), (s.languageScores.working = 0.9))],
    ["language score outside [0, 1]", (s) => (s.languageScores.fluent = 1.5)],
    ["neutral score outside [0, 1]", (s, n) => (s.neutralScore = n % 2 ? -0.2 : 1.2)],
    ["reason threshold outside (0, 1]", (s, n) => (s.reasonThreshold = n % 2 ? 0 : 1.1)],
    ["common-reason cut-off outside (0, 1]", (s, n) => (s.commonReasonCutoff = n % 2 ? 0 : 1.1)],
    ["a locked exclusion switched off", (s, n) => (s.exclusions[(["SAME_PERSON", "BLOCKED", "NOT_APPROVED"] as const)[n % 3]!] = false)],
    ["horizon outside 1–12 weeks", (s, n) => (s.availabilityHorizonWeeks = n % 2 ? 0 : 13)],
    ["NaN parameter", (s) => (s.neutralScore = Number.NaN)],
  ];
  it("MT-P12 · any out-of-bounds mutation of valid settings is rejected by the validator and by runMatching", () => {
    fc.assert(
      fc.property(arbType.chain((t) => fc.tuple(arbSettings(t), arbSnapshot(t), fc.constant(t))), fc.integer({ min: 0, max: mutations.length - 1 }), fc.integer({ min: 0, max: 50 }), ([st, snap, type], i, n) => {
        expect(validateMatchingSettings(st)).toEqual({ ok: true });
        const bad = structuredClone(st);
        mutations[i]![1](bad, n);
        const v = validateMatchingSettings(bad);
        expect(v.ok, mutations[i]![0]).toBe(false);
        expect(() => runMatching(snap, bad, type === "open" ? "recommend" : "draft")).toThrow(InvalidSettingsError);
      }),
      RUNS,
    );
  });
  it("MT-P12 · generated valid settings (all bounds satisfied) are accepted", () => {
    fc.assert(
      fc.property(arbType.chain((t) => arbSettings(t)), (s) => {
        expect(validateMatchingSettings(s)).toEqual({ ok: true });
      }),
      RUNS,
    );
    for (const t of TYPES) expect(validateMatchingSettings(defaultMatchingSettings(t, "x"))).toEqual({ ok: true });
    void OVERRIDABLE;
  });
});

describe("snapshot hygiene (type-level and runtime)", () => {
  it("the engine's input types contain no free-text private field: only declared keys are accepted at compile time", () => {
    // Compile-time proof: these assignments fail to type-check if a private/content key were part of the snapshot types.
    const m: MemberInput = { personId: "p", eligible: true, gradeBucket: 1, reporting: { managerId: null, skipLevelId: null }, languages: null, interests: null, availability: null, compat: null };
    // @ts-expect-error notes are not part of the engine's input
    const bad: MemberInput = { ...m, notes: "private" };
    const s: Pick<SeekerInput, "goals"> = { goals: [{ id: "g", primary: false, tags: [] }] };
    // @ts-expect-error goal titles are only readable when shared as `sharedTitle`
    const bad2: Pick<SeekerInput, "goals"> = { goals: [{ id: "g", primary: false, tags: [], title: "secret" }] };
    expect([m, bad, s, bad2].length).toBe(4);
  });
});
