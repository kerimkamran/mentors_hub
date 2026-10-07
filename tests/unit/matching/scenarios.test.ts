import { describe, expect, it } from "vitest";
import { diffMatchingResults, renderExplanation, runMatching, validateMatchingSettings } from "@/domain/matching";
import type { ExclusionCode, MatchingSettings, MatchingSnapshot } from "@/domain/matching/types";
import { InvalidMatchingInputError, InvalidSettingsError } from "@/domain/matching/types";
import { AS_OF, bareSettings, goal, member, mentee, mentor, rule, settings, snapshot, team, WEEKDAYS_AM } from "./fixtures";

const ids = (r: ReturnType<typeof runMatching>, seeker = 0) => r.seekers[seeker]!.candidates.map((c) => c.mentorId);
const sub = (c: { breakdown: { criterion: string; subscore: number }[] }, k: string) => c.breakdown.find((b) => b.criterion === k)!.subscore;
const codesOf = (r: ReturnType<typeof runMatching>, mentorId: string, seeker = 0) => r.seekers[seeker]!.excluded.find((e) => e.mentorId === mentorId)?.exclusions.map((e) => e.code);

describe("MT-S1 · Leadership: strong-fit pair beats stale-profile pair (FR-MAT-004)", () => {
  const questionnaire: MatchingSnapshot["questionnaire"] = [
    { id: "q1", section: "character", mode: "similar", scaleMin: 1, scaleMax: 5 },
    { id: "q2", section: "field", mode: "similar", scaleMin: 1, scaleMax: 5 },
    { id: "q3", section: "experience", mode: "complementary", scaleMin: 1, scaleMax: 5 },
  ];
  const answers = (a: number, b: number, c: number) => [
    { questionId: "q1", value: a },
    { questionId: "q2", value: b },
    { questionId: "q3", value: c },
  ];
  const snap = snapshot(
    "leadership",
    [mentee("e1", { goals: [goal("g1", ["strategy"], true)], member: { compat: answers(3, 3, 1) } })],
    [
      mentor("strong", { topics: [{ tagId: "strategy", depth: "expert" }], compat: answers(3, 3, 5) }),
      mentor("stale", { topics: [{ tagId: "strategy", depth: "working" }], availability: null, languages: null, gradeBucket: null, compat: null }),
    ],
    { questionnaire },
  );
  const r = runMatching(snap, settings("leadership"), "recommend");

  it("ranks the complete, well-fitting mentor first with golden totals 100 and 37.5", () => {
    expect(ids(r)).toEqual(["strong", "stale"]);
    expect(r.seekers[0]!.candidates.map((c) => c.total)).toEqual([100, 37.5]);
  });
  it("scores the stale profile 0 on every criterion the mentor has not provided (C-058)", () => {
    const stale = r.seekers[0]!.candidates[1]!;
    for (const k of ["availability", "career", "language", "other"]) {
      expect(sub(stale, k)).toBe(0);
      expect(stale.breakdown.find((b) => b.criterion === k)!.status).toBe("mentor_missing");
    }
    expect(sub(stale, "goal")).toBe(1);
    expect(sub(stale, "expertise")).toBe(0.5); // working depth factor (C-050)
  });
  it("explains the strong pair with at most 3 reasons, dropping the one true for the whole pool (FR-MAT-010)", () => {
    const codes = r.seekers[0]!.candidates[0]!.explanation.mentee.map((c) => c.code);
    expect(codes).toEqual(["EXPERTISE", "COMPATIBILITY", "CAREER"]); // goal alignment (1.0 for both) is dropped; ordered by weight × sub-score
  });
});

describe("MT-S2 · reporting line: manager and skip-level excluded; peers sharing a manager excluded in Leadership only (FR-MAT-002)", () => {
  const seeker = mentee("e2", { goals: [goal("g", ["strategy"])], member: { reporting: { managerId: "mgr", skipLevelId: "dir" } } });
  const mentors = [
    mentor("mgr"),
    mentor("dir"),
    mentor("peer", { reporting: { managerId: "mgr", skipLevelId: "dir" } }),
    mentor("report", { reporting: { managerId: "e2", skipLevelId: null } }), // the reverse direction
    mentor("other", { reporting: { managerId: "x", skipLevelId: null } }),
  ];
  it("Leadership: manager, skip-level and reverse line (REPORTING_LINE) and the peer (REPORTING_PEER) are excluded; only 'other' remains", () => {
    const r = runMatching(snapshot("leadership", [seeker], mentors), settings("leadership"), "recommend");
    expect(ids(r)).toEqual(["other"]);
    expect(codesOf(r, "mgr")).toEqual(["REPORTING_LINE"]);
    expect(codesOf(r, "dir")).toEqual(["REPORTING_LINE"]);
    expect(codesOf(r, "report")).toEqual(["REPORTING_LINE"]);
    expect(codesOf(r, "peer")).toEqual(["REPORTING_PEER"]);
  });
  it("Open: the same peer is allowed (C-087 off by default) but manager and skip-level stay excluded (C-086)", () => {
    const r = runMatching(snapshot("open", [seeker], mentors), settings("open"), "recommend");
    expect(ids(r).sort()).toEqual(["other", "peer"].sort());
    expect(codesOf(r, "mgr")).toEqual(["REPORTING_LINE"]);
  });
  it("a PM override with a pair-level record returns the pair and records the overridden code", () => {
    const snap = snapshot("leadership", [seeker], mentors, { overrides: [{ seekerId: "e2", mentorId: "mgr", code: "REPORTING_LINE" }] });
    const r = runMatching(snap, settings("leadership"), "recommend");
    expect(ids(r)).toContain("mgr");
    expect(r.seekers[0]!.candidates.find((c) => c.mentorId === "mgr")!.overriddenCodes).toEqual(["REPORTING_LINE"]);
  });
});

describe("MT-S3 · Open: mentor-junior allowed (reverse mentoring) and scored 0.30 on career (C-054, C-088)", () => {
  const seeker = mentee("e3", { goals: [goal("g", ["strategy"])], member: { gradeBucket: 4 } });
  const m = mentor("junior", { gradeBucket: 3 });
  it("Open keeps the pair and gives career 0.30", () => {
    const r = runMatching(snapshot("open", [seeker], [m]), settings("open"), "recommend");
    expect(ids(r)).toEqual(["junior"]);
    expect(sub(r.seekers[0]!.candidates[0]!, "career")).toBe(0.3);
  });
  it("Leadership excludes the pair (MENTOR_JUNIOR on by default)", () => {
    const r = runMatching(snapshot("leadership", [seeker], [m]), settings("leadership"), "recommend");
    expect(ids(r)).toEqual([]);
    expect(codesOf(r, "junior")).toEqual(["MENTOR_JUNIOR"]);
  });
  it("never phrases the reverse-mentoring band to the mentee, even if the reason threshold is lowered", () => {
    const st = settings("open", (s) => (s.reasonThreshold = 0.3));
    const r = runMatching(snapshot("open", [seeker], [m, mentor("x", { gradeBucket: 5 })]), st, "recommend");
    const all = r.seekers[0]!.candidates.flatMap((c) => c.explanation.mentee);
    expect(all.some((c) => c.code === "CAREER" && (c.band as string) === "mentor_junior")).toBe(false);
  });
});

describe("MT-S4 · SparkLab: team quorum — a slot with the lead but < 60% of members is not counted (C-027, FR-MAT-016)", () => {
  const monday = [rule(1, 600, 720)];
  const free = { availability: monday };
  const none = { availability: null };
  const mentors = [mentor("mentor", { availability: monday, capacity: 2 })];
  const run = (members: Record<string, Partial<ReturnType<typeof member>>>) =>
    runMatching(snapshot("sparklab", [team("t1", ["lead", "a", "b", "c", "d"], "lead", { needed: ["strategy"], members })], mentors), settings("sparklab"), "recommend");

  it("lead + 1 of 5 free (40%) → no counted slot → NO_AVAILABILITY exclusion", () => {
    const r = run({ lead: free, a: free, b: none, c: none, d: none });
    expect(codesOf(r, "mentor")).toEqual(["NO_AVAILABILITY"]);
  });
  it("lead + 2 of 5 free (exactly 60%) → one counted day → availability sub-score 1/3", () => {
    const r = run({ lead: free, a: free, b: free, c: none, d: none });
    expect(ids(r)).toEqual(["mentor"]);
    expect(sub(r.seekers[0]!.candidates[0]!, "availability")).toBe(0.33);
  });
  it("4 members free but not the lead → nothing counted (the lead is always required)", () => {
    const r = run({ lead: none, a: free, b: free, c: free, d: free });
    // lead has no availability at all: not provided → neutral score, and no exclusion can be raised from missing data
    expect(sub(r.seekers[0]!.candidates[0]!, "availability")).toBe(0.5);
    const r2 = run({ lead: { availability: [rule(2, 600, 720)] }, a: free, b: free, c: free, d: free });
    expect(codesOf(r2, "mentor")).toEqual(["NO_AVAILABILITY"]);
  });
});

describe("MT-S5 · missing data: a blank mentor profile scores 0 and never outranks a complete one (C-057, C-058, FR-MAT-005)", () => {
  const seeker = mentee("e5", { goals: [goal("g", ["strategy"])] });
  const blank = mentor("a-blank", { topics: [], availability: null, languages: null, interests: null, gradeBucket: null, compat: null });
  const complete = mentor("z-complete", { interests: ["chess"] });
  const r = runMatching(snapshot("open", [seeker], [blank, complete]), settings("open"), "recommend");
  it("blank mentor scores 0 on every criterion it could have provided, even though its id sorts first", () => {
    const c = r.seekers[0]!.candidates;
    expect(c.map((x) => x.mentorId)).toEqual(["z-complete", "a-blank"]);
    const blankScores = c[1]!.breakdown.filter((b) => b.criterion !== "other");
    expect(blankScores.every((b) => b.subscore === 0 && b.status === "mentor_missing")).toBe(true);
    // Open without compatibility questions: "other" is neutral for everyone (§4.7), so the blank total is exactly that neutral share.
    expect(c[1]!.total).toBe(2.5);
    expect(c[0]!.total).toBeGreaterThan(c[1]!.total);
  });
  it("a mentee with no goals / interests gets the neutral 0.50 against a provided mentor profile (C-057)", () => {
    const rr = runMatching(snapshot("open", [mentee("no-goals")], [complete]), settings("open"), "recommend");
    const c = rr.seekers[0]!.candidates[0]!;
    expect(sub(c, "goal")).toBe(0.5);
    expect(sub(c, "expertise")).toBe(0.5);
    expect(sub(c, "interests")).toBe(0.5);
    expect(c.breakdown.find((b) => b.criterion === "goal")!.status).toBe("neutral_seeker_missing");
  });
  it("when both sides are missing, the mentor rule wins: 0.00", () => {
    const rr = runMatching(snapshot("open", [mentee("no-goals")], [blank]), settings("open"), "recommend");
    expect(sub(rr.seekers[0]!.candidates[0]!, "goal")).toBe(0);
  });
  it("a mentor below the minimum profile (C-032) is out of the pool, not scored; a PM can mark them browsable but they are never recommended", () => {
    const low = mentor("low", { minimumProfile: false });
    const r1 = runMatching(snapshot("open", [seeker], [low]), settings("open"), "recommend");
    expect(r1.seekers[0]!.outOfPool).toEqual([{ mentorId: "low", reason: "MINIMUM_PROFILE" }]);
    const r2 = runMatching(snapshot("open", [seeker], [{ ...low, browsableWithoutMinimumProfile: true }, complete]), settings("open"), "recommend");
    expect(ids(r2)).toContain("low");
    expect(r2.seekers[0]!.recommended).not.toContain("low");
    expect(r2.seekers[0]!.candidates.find((c) => c.mentorId === "low")!.recommendable).toBe(false);
  });
});

describe("MT-S6 · capacity: mentor at cap excluded; override with reason returns the pair (C-091, FR-MAT-014)", () => {
  const seeker = mentee("e6", { goals: [goal("g", ["strategy"])] });
  const full = mentor("full", { capacity: 2, load: 2 });
  const free = mentor("free", { capacity: 2, load: 1 });
  it("excludes the full mentor", () => {
    const r = runMatching(snapshot("leadership", [seeker], [full, free]), settings("leadership"), "recommend");
    expect(ids(r)).toEqual(["free"]);
    expect(codesOf(r, "full")).toEqual(["CAPACITY_FULL"]);
  });
  it("an override record returns the pair, but the automatic draft still never exceeds capacity (MT-P4)", () => {
    const snap = snapshot("leadership", [seeker], [full], { overrides: [{ seekerId: "e6", mentorId: "full", code: "CAPACITY_FULL" }] });
    const r = runMatching(snap, settings("leadership"), "draft");
    expect(ids(r)).toEqual(["full"]);
    expect(r.draft!.assignments).toEqual([]);
    expect(r.draft!.unmatched).toEqual(["e6"]);
  });
  it("a team consumes one unit (C-022): one free unit takes exactly one team in the draft", () => {
    const snap = snapshot("sparklab", [team("t-a", ["a1", "a2"], "a1", { needed: ["strategy"] }), team("t-b", ["b1", "b2"], "b1", { needed: ["strategy"] })], [mentor("m", { capacity: 2, load: 1 })]);
    const r = runMatching(snap, settings("sparklab"), "draft");
    expect(r.draft!.assignments).toHaveLength(1);
    expect(r.draft!.unmatched).toHaveLength(1);
  });
});

describe("MT-S7 · tie-break chain exercised through all four levels (matching-spec §5)", () => {
  // weights goal 50 + availability 50. Mentee goals: g1 (primary, strategy) weight 2, g2 (ml) weight 1.
  const st = bareSettings("open", { goal: 50, availability: 50 });
  const seeker = mentee("e7", { goals: [goal("g1", ["strategy"], true), goal("g2", ["ml"])] });
  const days = (n: number) => [1, 2, 3].slice(0, n).map((d) => rule(d as 1 | 2 | 3, 600, 720));
  const both = [{ tagId: "strategy", depth: "expert" as const }, { tagId: "ml", depth: "expert" as const }];
  const mentors = [
    mentor("m-a", { topics: both, availability: days(3) }), // goal 1.00, avail 1.00 → 100
    mentor("m-b", { topics: [{ tagId: "strategy", depth: "expert" }], availability: days(1) }), // goal .67, avail .33 → 100·… = 50
    mentor("m-b2", { topics: [{ tagId: "strategy", depth: "expert" }], availability: days(1) }), // twin of m-b (level 4: id)
    mentor("m-c", { topics: [{ tagId: "ml", depth: "expert" }], availability: days(2) }), // goal .33, avail .67 → 50 (level 3: lower goal)
    mentor("m-d", { topics: [{ tagId: "strategy", depth: "expert" }], availability: days(1), load: 1 }), // same as m-b but load 1 (level 2)
  ];
  it("orders by total, then lower load, then higher goal alignment, then mentor id", () => {
    const r = runMatching(snapshot("open", [seeker], mentors), st, "recommend");
    const c = r.seekers[0]!.candidates;
    expect(c.map((x) => x.mentorId)).toEqual(["m-a", "m-b", "m-b2", "m-c", "m-d"]);
    expect(c.map((x) => x.total)).toEqual([100, 50, 50, 50, 50]);
    expect(sub(c[1]!, "goal")).toBe(0.67);
    expect(sub(c[3]!, "goal")).toBe(0.33);
  });
});

describe("MT-S8 · rematch: a declined pair is excluded for C-004 (90 days) and the previous mentor is excluded (matching-spec §7)", () => {
  const seeker = mentee("e8", { goals: [goal("g", ["strategy"])] });
  const m = mentor("m");
  const withDecline = (on: string) => runMatching(snapshot("open", [seeker], [m], { history: [{ seekerId: "e8", mentorId: "m", kind: "declined", on }] }), settings("open"), "recommend");
  it("declined 89 days before as_of → excluded; 90 days before → available again", () => {
    expect(codesOf(withDecline("2026-07-08"), "m")).toEqual(["DECLINED_RECENTLY"]); // 2026-10-05 − 89 d
    expect(ids(withDecline("2026-07-07"))).toEqual(["m"]); // 90 d
  });
  it("a PM override returns the declined pair", () => {
    const snap = snapshot("open", [seeker], [m], { history: [{ seekerId: "e8", mentorId: "m", kind: "declined", on: "2026-09-30" }], overrides: [{ seekerId: "e8", mentorId: "m", code: "DECLINED_RECENTLY" }] });
    expect(ids(runMatching(snap, settings("open"), "recommend"))).toEqual(["m"]);
  });
  it("the previous mentor of a rematch is excluded unless the PM overrides, even if the incompatible-history switch is off", () => {
    const st = settings("open", (s) => (s.exclusions.INCOMPATIBLE_HISTORY = false));
    const snap = snapshot("open", [seeker], [m], { history: [{ seekerId: "e8", mentorId: "m", kind: "rematch_previous", on: null }] });
    expect(codesOf(runMatching(snap, st, "recommend"), "m")).toEqual(["INCOMPATIBLE_HISTORY"]);
    const over = runMatching({ ...snap, overrides: [{ seekerId: "e8", mentorId: "m", code: "INCOMPATIBLE_HISTORY" }] }, st, "recommend");
    expect(ids(over)).toEqual(["m"]);
  });
  it("for a team the decline of any member counts", () => {
    const snap = snapshot("sparklab", [team("t", ["l", "x"], "l", { needed: ["strategy"] })], [m], { history: [{ seekerId: "x", mentorId: "m", kind: "declined", on: "2026-10-01" }] });
    expect(codesOf(runMatching(snap, settings("sparklab"), "recommend"), "m")).toEqual(["DECLINED_RECENTLY"]);
  });
});

describe("MT-S9 · a reason true for ≥ C-060 (90%) of the pool is dropped from every explanation (FR-MAT-010)", () => {
  const seeker = mentee("e9", { goals: [goal("g", ["strategy"])] });
  const pool = (withLanguage: number) =>
    Array.from({ length: 10 }, (_, i) =>
      mentor(`m${i}`, { languages: i < withLanguage ? [{ language: "az", level: "fluent" }] : [{ language: "tr", level: "fluent" }], topics: [{ tagId: i % 2 ? "strategy" : "finance", depth: "expert" }] }),
    );
  const st = settings("open", (s) => (s.exclusions.NO_LANGUAGE = false));
  const langReasons = (r: ReturnType<typeof runMatching>) => r.seekers[0]!.candidates.filter((c) => c.explanation.mentee.some((x) => x.code === "LANGUAGE")).length;
  it("language true for 9 of 10 (90%) → dropped for everyone", () => {
    expect(langReasons(runMatching(snapshot("open", [seeker], pool(9)), st, "recommend"))).toBe(0);
  });
  it("language true for 8 of 10 (80%) → shown to those it applies to", () => {
    const r = runMatching(snapshot("open", [seeker], pool(8)), st, "recommend");
    expect(langReasons(r)).toBeGreaterThan(0);
  });
  it("an explanation is never empty: the generic line is used when every reason is dropped", () => {
    const r = runMatching(snapshot("open", [seeker], pool(10).map((m) => ({ ...m, topics: [{ tagId: "strategy", depth: "expert" as const }] }))), st, "recommend");
    for (const c of r.seekers[0]!.candidates) expect(c.explanation.mentee).toEqual([{ code: "GENERIC_FIT" }]);
    expect(renderExplanation(r.seekers[0]!.candidates[0]!.explanation.mentee, "en")).toEqual(["A good overall fit for your goals"]);
  });
});

describe("FR-MAT-002 · all 13 hard exclusion codes, locked vs overridable", () => {
  const seeker = mentee("s", { goals: [goal("g", ["strategy"])], member: { gradeBucket: 3 } });
  type Case = { code: ExclusionCode; snap: (type: "leadership") => MatchingSnapshot };
  const sn = (m: Parameters<typeof mentor>[1], extra: Partial<MatchingSnapshot> = {}, s = seeker) => snapshot("leadership", [s], [mentor("x", m)], extra);
  const cases: [ExclusionCode, MatchingSnapshot][] = [
    ["SAME_PERSON", snapshot("leadership", [seeker], [mentor("s")])],
    ["BLOCKED", sn({}, { blocks: [{ blockerId: "x", blockedId: "s" }] })],
    ["NOT_APPROVED", sn({ approved: false })],
    ["ELIGIBILITY", sn({ eligible: false })],
    ["INCOMPATIBLE_HISTORY", sn({}, { history: [{ seekerId: "s", mentorId: "x", kind: "incompatible", on: null }] })],
    ["DECLINED_RECENTLY", sn({}, { history: [{ seekerId: "s", mentorId: "x", kind: "declined", on: AS_OF }] })],
    ["REPORTING_LINE", sn({ reporting: { managerId: "s", skipLevelId: null } })],
    ["REPORTING_PEER", sn({ reporting: { managerId: "boss", skipLevelId: null } }, {}, mentee("s", { goals: [goal("g", ["strategy"])], member: { reporting: { managerId: "boss", skipLevelId: null } } }))],
    ["MENTOR_JUNIOR", sn({ gradeBucket: 1 })],
    ["NO_LANGUAGE", sn({ languages: [{ language: "tr", level: "fluent" }] })],
    ["NO_AVAILABILITY", sn({ availability: [rule(7, 600, 660)] })],
    ["CAPACITY_FULL", sn({ capacity: 1, load: 1 })],
    ["ALREADY_MATCHED", sn({}, {}, mentee("s", { goals: [goal("g", ["strategy"])], accepted: 1 }))],
  ];
  for (const [code, snap] of cases) {
    it(`${code} excludes the pair and is ${code === "SAME_PERSON" || code === "BLOCKED" || code === "NOT_APPROVED" ? "locked (cannot be overridden)" : "overridable by a PM"}`, () => {
      const r = runMatching(snap, settings("leadership"), "recommend");
      expect(codesOf(r, "x") ?? codesOf(r, "s")).toContain(code);
      expect(r.seekers[0]!.candidates).toEqual([]);
      const locked = ["SAME_PERSON", "BLOCKED", "NOT_APPROVED"].includes(code);
      const target = code === "SAME_PERSON" ? "s" : "x";
      const over = runMatching({ ...snap, overrides: [{ seekerId: "s", mentorId: target, code }] }, settings("leadership"), "recommend");
      expect(ids(over).includes(target)).toBe(!locked);
      expect(r.seekers[0]!.excluded[0]!.exclusions.find((e) => e.code === code)!.locked).toBe(locked);
    });
  }
  it("an exclusion switched off by the programme is not evaluated (FR-PRG-011)", () => {
    const off = settings("leadership", (s) => (s.exclusions.CAPACITY_FULL = false));
    const r = runMatching(sn({ capacity: 1, load: 1 }), off, "recommend");
    expect(ids(r)).toEqual(["x"]);
  });
  it("an exclusion is never raised from missing data (no availability / languages provided)", () => {
    const r = runMatching(sn({ availability: null, languages: null }), settings("leadership"), "recommend");
    expect(ids(r)).toEqual(["x"]);
  });
  it("a mentor from another organisation is outside the pool", () => {
    const r = runMatching(sn({ organisationId: "org-other" }), settings("leadership"), "recommend");
    expect(r.seekers[0]!.outOfPool).toEqual([{ mentorId: "x", reason: "ORGANISATION" }]);
  });
  it("Open: up to C-023 pending requests are allowed before ALREADY_MATCHED", () => {
    const one = runMatching(snapshot("open", [mentee("s", { pending: 1 })], [mentor("x")]), settings("open"), "recommend");
    expect(ids(one)).toEqual(["x"]);
    const two = runMatching(snapshot("open", [mentee("s", { pending: 2 })], [mentor("x")]), settings("open"), "recommend");
    expect(codesOf(two, "x")).toEqual(["ALREADY_MATCHED"]);
  });
});

describe("FR-MAT-004 · scoring formulas (matching-spec §4)", () => {
  it("§4.1/4.2 goal alignment: primary goals weigh C-051 (×2); parent/child tags earn C-052 partial credit; depth factors apply to expertise", () => {
    const seeker = mentee("s", { goals: [goal("g1", ["ml"], true), goal("g2", ["finance"])] });
    // mentor offers `data` (parent of ml) at advanced depth
    const r = runMatching(snapshot("open", [seeker], [mentor("m", { topics: [{ tagId: "data", depth: "advanced" }] })]), settings("open"), "recommend");
    const c = r.seekers[0]!.candidates[0]!;
    expect(sub(c, "goal")).toBe(0.33); // (2×0.5 + 1×0) / 3
    expect(sub(c, "expertise")).toBe(0.19); // (0.5×0.75 + 0) / 2 = 0.1875
  });
  it("synonyms are normalised before matching (mgmt ≡ people-management)", () => {
    const seeker = mentee("s", { goals: [goal("g", ["mgmt"])] });
    const r = runMatching(snapshot("open", [seeker], [mentor("m", { topics: [{ tagId: "people-management", depth: "expert" }] })]), settings("open"), "recommend");
    expect(sub(r.seekers[0]!.candidates[0]!, "goal")).toBe(1);
  });
  it("§4.3 availability saturates at C-053 days", () => {
    const st = bareSettings("open", { availability: 100 });
    const mk = (n: number) => mentor(`m${n}`, { availability: [1, 2, 3, 4, 5].slice(0, n).map((d) => rule(d as 1, 600, 720)) });
    const r = runMatching(snapshot("open", [mentee("s")], [mk(1), mk(2), mk(3), mk(4)]), st, "recommend");
    const by = Object.fromEntries(r.seekers[0]!.candidates.map((c) => [c.mentorId, sub(c, "availability")]));
    expect(by).toEqual({ m1: 0.33, m2: 0.67, m3: 1, m4: 1 });
  });
  it("§4.3 availability honours validity dates and the horizon (C-150)", () => {
    const st = bareSettings("open", { availability: 100 });
    const lateRule = { ...rule(1, 600, 720), validFrom: "2026-11-30", validTo: null }; // starts after a 4-week horizon from 2026-10-05
    const r = runMatching(snapshot("open", [mentee("s")], [mentor("late", { availability: [lateRule] })]), { ...st, exclusions: { ...st.exclusions, NO_AVAILABILITY: true } }, "recommend");
    expect(codesOf(r, "late")).toEqual(["NO_AVAILABILITY"]);
    const wide = runMatching(snapshot("open", [mentee("s")], [mentor("late", { availability: [lateRule] })]), { ...st, availabilityHorizonWeeks: 12, exclusions: { ...st.exclusions, NO_AVAILABILITY: true } }, "recommend");
    expect(ids(wide)).toEqual(["late"]);
  });
  it("§4.4 career bands: ahead 1.00, peer 0.60, far 0.40 (C-054, C-055)", () => {
    const st = bareSettings("open", { career: 100 });
    const mk = (b: number) => mentor(`m${b}`, { gradeBucket: b });
    const r = runMatching(snapshot("open", [mentee("s", { member: { gradeBucket: 2 } })], [mk(1), mk(2), mk(3), mk(4), mk(5), mk(6)]), st, "recommend");
    const by = Object.fromEntries(r.seekers[0]!.candidates.map((c) => [c.mentorId, sub(c, "career")]));
    expect(by).toEqual({ m1: 0.3, m2: 0.6, m3: 1, m4: 1, m5: 0.4, m6: 0.4 });
  });
  it("§4.5 language: both fluent 1.00, otherwise working 0.70 (C-056)", () => {
    const st = bareSettings("open", { language: 100 });
    const r = runMatching(
      snapshot("open", [mentee("s", { member: { languages: [{ language: "az", level: "fluent" }, { language: "en", level: "working" }] } })], [
        mentor("both", { languages: [{ language: "az", level: "fluent" }] }),
        mentor("weak", { languages: [{ language: "en", level: "fluent" }] }),
        mentor("weak2", { languages: [{ language: "az", level: "working" }] }),
      ]),
      st,
      "recommend",
    );
    const by = Object.fromEntries(r.seekers[0]!.candidates.map((c) => [c.mentorId, sub(c, "language")]));
    expect(by).toEqual({ both: 1, weak: 0.7, weak2: 0.7 });
  });
  it("§4.6 interests use Jaccard similarity", () => {
    const st = bareSettings("open", { interests: 100 });
    const r = runMatching(snapshot("open", [mentee("s", { member: { interests: ["running", "chess"] } })], [mentor("m", { interests: ["chess", "music"] })]), st, "recommend");
    expect(sub(r.seekers[0]!.candidates[0]!, "interests")).toBe(0.33);
  });
  it("§4.7 compatibility: similar vs complementary questions, section means then overall mean", () => {
    const st = bareSettings("leadership", { other: 100 });
    const q: MatchingSnapshot["questionnaire"] = [
      { id: "c1", section: "character", mode: "similar", scaleMin: 0, scaleMax: 10 },
      { id: "c2", section: "character", mode: "complementary", scaleMin: 0, scaleMax: 10 },
      { id: "f1", section: "field", mode: "similar", scaleMin: 0, scaleMax: 10 },
    ];
    const seeker = mentee("s", { member: { compat: [{ questionId: "c1", value: 2 }, { questionId: "c2", value: 2 }, { questionId: "f1", value: 5 }] } });
    const m = mentor("m", { compat: [{ questionId: "c1", value: 4 }, { questionId: "c2", value: 8 }, { questionId: "f1", value: 5 }] });
    const r = runMatching(snapshot("leadership", [seeker], [m], { questionnaire: q }), st, "recommend");
    // character: similar 1−2/10=0.8, complementary 6/10=0.6 → mean 0.7; field: 1.0; overall (0.7+1)/2 = 0.85
    expect(sub(r.seekers[0]!.candidates[0]!, "other")).toBe(0.85);
  });
  it("§4.7 Open without optional compatibility questions: neutral for everyone", () => {
    const r = runMatching(snapshot("open", [mentee("s")], [mentor("m")]), settings("open"), "recommend");
    const b = r.seekers[0]!.candidates[0]!.breakdown.find((x) => x.criterion === "other")!;
    expect(b).toMatchObject({ subscore: 0.5, status: "neutral_seeker_missing" });
  });
  it("§4.8 SparkLab: needed expertise replaces goals; phase mismatch multiplies Expertise by 0.8 (OQ-B1-17)", () => {
    const t = team("t", ["l", "x"], "l", { needed: ["strategy"], phase: "design" });
    const r = runMatching(snapshot("sparklab", [t], [mentor("has", { phases: ["design"] }), mentor("lacks", { phases: ["test"] })]), settings("sparklab"), "recommend");
    const by = Object.fromEntries(r.seekers[0]!.candidates.map((c) => [c.mentorId, [sub(c, "goal"), sub(c, "expertise")]]));
    expect(by).toEqual({ has: [1, 1], lacks: [1, 0.8] });
    expect(r.seekers[0]!.candidates[0]!.explanation.mentee.find((x) => x.code === "GOAL_ALIGNMENT")).toBeUndefined(); // true for the whole pool → dropped
  });
  it("totals use 2-decimal sub-scores and stay in [0, 100] (C-061)", () => {
    const r = runMatching(snapshot("open", [mentee("s", { goals: [goal("g", ["strategy"])] })], [mentor("m")]), settings("open"), "recommend");
    const c = r.seekers[0]!.candidates[0]!;
    expect(c.total).toBe(c.breakdown.reduce((a, b) => a + b.contribution, 0));
  });
});

describe("FR-MAT-008 / FR-MAT-009 · Open recommendations and the admin draft", () => {
  it("Open: recommended = first C-024 (5) recommendable candidates in ranking order; browse = all candidates", () => {
    const mentors = Array.from({ length: 8 }, (_, i) => mentor(`m${i}`, { topics: [{ tagId: i < 6 ? "strategy" : "finance", depth: "expert" }] }));
    const r = runMatching(snapshot("open", [mentee("s", { goals: [goal("g", ["strategy"])] })], mentors), settings("open"), "recommend");
    expect(r.seekers[0]!.candidates).toHaveLength(8);
    expect(r.seekers[0]!.recommended).toEqual(r.seekers[0]!.candidates.slice(0, 5).map((c) => c.mentorId));
    expect(r.draft).toBeNull();
  });
  it("draft: seekers with fewest options are placed first; each takes the top-ranked mentor with remaining capacity; the rest stay unmatched", () => {
    // 'few' has only mentor m1 as an option (m2 is blocked); 'many' prefers m1 too. m1 has capacity 1.
    const seekers = [mentee("many", { goals: [goal("g", ["strategy"])] }), mentee("few", { goals: [goal("g", ["strategy"])] })];
    const mentors = [mentor("m1", { capacity: 1 }), mentor("m2", { capacity: 1, topics: [{ tagId: "finance", depth: "working" }] })];
    const r = runMatching(snapshot("leadership", seekers, mentors, { blocks: [{ blockerId: "few", blockedId: "m2" }] }), settings("leadership"), "draft");
    expect(r.draft!.assignments.map((a) => [a.seekerId, a.mentorId])).toEqual([["few", "m1"], ["many", "m2"]]);
    const r2 = runMatching(snapshot("leadership", [...seekers, mentee("third", { goals: [goal("g", ["strategy"])] })], mentors), settings("leadership"), "draft");
    expect(r2.draft!.unmatched).toHaveLength(1);
  });
  it("the admin draft is not available for Open programmes", () => {
    expect(() => runMatching(snapshot("open", [mentee("s")], [mentor("m")]), settings("open"), "draft")).toThrow(InvalidMatchingInputError);
  });
});

describe("FR-MAT-018 · settings arrive with the snapshot (MT-P11, MT-P12 examples)", () => {
  const snap = snapshot("leadership", [mentee("s", { goals: [goal("g", ["strategy"], true)] })], [mentor("m1"), mentor("m2", { topics: [{ tagId: "ml", depth: "expert" }] })]);
  it("the result names the settings version and a hash that changes with the parameters", () => {
    const a = runMatching(snap, settings("leadership", () => {}, "v1"), "recommend");
    const b = runMatching(snap, settings("leadership", (s) => (s.depthFactors.working = 0.4), "v2"), "recommend");
    expect([a.settingsVersionId, b.settingsVersionId]).toEqual(["v1", "v2"]);
    expect(a.snapshotHash).not.toBe(b.snapshotHash);
    expect(a.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
  const bad: [string, (s: MatchingSettings) => void][] = [
    ["weights not totalling 100", (s) => (s.weights.goal += 1)],
    ["negative weight", (s) => ((s.weights.goal = -5), (s.weights.expertise += 30))],
    ["fractional weight", (s) => ((s.weights.goal += 0.5), (s.weights.expertise -= 0.5))],
    ["depth factors out of order", (s) => ((s.depthFactors.working = 0.9), (s.depthFactors.advanced = 0.5))],
    ["depth factor zero", (s) => (s.depthFactors.working = 0)],
    ["primary multiplier 6", (s) => (s.primaryGoalMultiplier = 6)],
    ["partial credit above 1", (s) => (s.taxonomyPartialCredit = 1.1)],
    ["saturation 0 days", (s) => (s.availabilitySaturationDays = 0)],
    ["band score above 1", (s) => (s.careerBands[0]!.score = 1.2)],
    ["career bands overlap", (s) => (s.careerBands[2]!.minGap = 0)],
    ["career bands leave a gap", (s) => (s.careerBands[1]!.maxGap = -0 + 0 - 0 + 0, (s.careerBands[2]!.minGap = 2))],
    ["language fluent below working", (s) => ((s.languageScores.fluent = 0.5), (s.languageScores.working = 0.7))],
    ["neutral score 1.5", (s) => (s.neutralScore = 1.5)],
    ["reason threshold 0", (s) => (s.reasonThreshold = 0)],
    ["cut-off above 1", (s) => (s.commonReasonCutoff = 1.5)],
    ["locked exclusion switched off", (s) => (s.exclusions.BLOCKED = false)],
    ["horizon 13 weeks", (s) => (s.availabilityHorizonWeeks = 13)],
    ["horizon 0 weeks", (s) => (s.availabilityHorizonWeeks = 0)],
    ["missing version id", (s) => (s.versionId = "")],
  ];
  for (const [name, mutate] of bad)
    it(`MT-P12 · rejects ${name} before it can reach the engine`, () => {
      const s = settings("leadership");
      mutate(s);
      const v = validateMatchingSettings(s);
      expect(v.ok).toBe(false);
      expect(() => runMatching(snap, s, "recommend")).toThrow(InvalidSettingsError);
    });
  it("accepts every default settings object", () => {
    for (const t of ["open", "leadership", "sparklab"] as const) expect(validateMatchingSettings(settings(t))).toEqual({ ok: true });
  });
});

describe("diffMatchingResults — what-if helper for the settings preview", () => {
  const seekers = [mentee("s1", { goals: [goal("g", ["strategy"], true)] }), mentee("s2", { goals: [goal("g", ["ml"], true)] })];
  const mentors = [mentor("m1", { capacity: 1 }), mentor("m2", { capacity: 1, topics: [{ tagId: "ml", depth: "expert" }] })];
  const snap = snapshot("leadership", seekers, mentors);
  it("reports no change for identical settings", () => {
    const a = runMatching(snap, settings("leadership"), "draft");
    const d = diffMatchingResults(a, runMatching(snap, settings("leadership"), "draft"));
    expect(d.identical).toBe(true);
    expect(d.seekersCompared).toBe(2);
  });
  it("counts changed lists, top-5 changes, draft pair changes and newly excluded pairs when the settings change", () => {
    const a = runMatching(snap, settings("leadership"), "draft");
    const b = runMatching(snap, settings("leadership", (s) => ((s.weights = { goal: 0, expertise: 0, availability: 0, career: 0, language: 0, interests: 0, other: 100 }), (s.exclusions.CAPACITY_FULL = false))), "draft");
    const d = diffMatchingResults(a, b);
    expect(d.identical).toBe(false);
    expect(d.changedCandidateLists).toBeGreaterThan(0);
    expect(d.top5Changes.length).toBe(d.changedCandidateLists);
    expect(d.draftPairChanges.every((x) => x.before !== x.after)).toBe(true);
  });
  it("detects a candidate that drops out of the pool", () => {
    const a = runMatching(snap, settings("leadership"), "recommend");
    const b = runMatching(snapshot("leadership", seekers, [mentors[0]!, { ...mentors[1]!, load: 1 }]), settings("leadership"), "recommend");
    const d = diffMatchingResults(a, b);
    expect(d.newlyExcludedPairs).toBe(2);
    expect(d.newlyEligiblePairs).toBe(0);
  });
});

describe("INV-7.1 · hashing and determinism", () => {
  it("MT-P6 · snapshot hash is stable and ignores input order and private fields", () => {
    const a = snapshot("open", [mentee("s", { goals: [goal("g", ["strategy"])] })], [mentor("m1"), mentor("m2")]);
    const b = snapshot("open", [mentee("s", { goals: [goal("g", ["strategy"])] })], [mentor("m2"), mentor("m1")]);
    (b.mentors[0] as unknown as Record<string, unknown>).privateNotes = "never read";
    expect(runMatching(a, settings("open"), "recommend")).toEqual(runMatching(b, settings("open"), "recommend"));
  });
  it("monthly-run example: a snapshot with unchanged inputs hashes identically across calls", () => {
    const a = snapshot("open", [mentee("s")], [mentor("m")]);
    expect(runMatching(a, settings("open"), "recommend").snapshotHash).toBe(runMatching(structuredClone(a), settings("open"), "recommend").snapshotHash);
  });
  it("rejects malformed snapshots (fail closed)", () => {
    const a = snapshot("open", [mentee("s")], [mentor("m"), mentor("m")]);
    expect(() => runMatching(a, settings("open"), "recommend")).toThrow(InvalidMatchingInputError);
    expect(() => runMatching({ ...snapshot("open", [], []), programme: { id: "p", type: "open", asOf: "2026-13-40" } }, settings("open"), "recommend")).toThrow(InvalidMatchingInputError);
  });
  it("the 2026 reference week starts on a Monday (calendar helper)", () => {
    expect(new Date(`${AS_OF}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(WEEKDAYS_AM).toHaveLength(5);
  });
});
