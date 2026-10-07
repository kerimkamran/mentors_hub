import { describe, expect, it } from "vitest";
import { VETTING_BOUNDS } from "../../src/domain/vetting/defaults";
import { conflictOfInterest } from "../../src/domain/vetting/conflicts";
import {
  allItems, averageScores, averageTotal, bandFor, cleanScores, decisionDiffers, maxTotal, missingItems, reasonProblem, totalOf, validateRubric, type AdvisoryOutcome, type RubricBand,
} from "../../src/domain/vetting/rubric";
import { LEADERSHIP_SEED, RUBRIC_SEEDS, SPARKLAB_SEED, seedDefinition } from "../../src/domain/vetting/rubric-data";
import { canTransition, cooloffBlocks, missingParts, STATUSES, TRANSITIONS } from "../../src/domain/vetting/rules";
import { scheduleReminder, setReminderScheduler } from "../../src/domain/vetting/reminders";
import { setVettingSettingsOverride, vettingSettings } from "../../src/domain/vetting/settings";

/** Small deterministic PRNG so the property loops are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

describe("FR-VET-004 · seeded rubrics", () => {
  const lead = seedDefinition(LEADERSHIP_SEED), spark = seedDefinition(SPARKLAB_SEED);
  it("FR-VET-004 · Leadership has 35 items in 7 sections, SparkLab 20 items in 4 sections, both valid", () => {
    expect(allItems(lead)).toHaveLength(35);
    expect(lead.sections).toHaveLength(7);
    expect(allItems(spark)).toHaveLength(20);
    expect(spark.sections).toHaveLength(4);
    expect(validateRubric(lead)).toEqual([]);
    expect(validateRubric(spark)).toEqual([]);
    expect(maxTotal(lead)).toBe(140);
    expect(maxTotal(spark)).toBe(80);
  });
  it("FR-VET-004 · bands are 55 % and 70 % of the maximum for both rubrics", () => {
    for (const r of [lead, spark]) {
      const max = maxTotal(r);
      expect(r.bands.map((b) => b.min)).toEqual([0, Math.round(max * 0.55), Math.round(max * 0.7)]);
    }
  });
  it("FR-VET-004 · every item and section has a distinct code and a message key per rubric version", () => {
    for (const seed of RUBRIC_SEEDS) {
      const d = seedDefinition(seed);
      const keys = [...d.sections.map((s) => s.labelKey), ...allItems(d).map((i) => i.labelKey)];
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.every((k) => k.startsWith(`vetting.rubric.${seed.code}.v1.`))).toBe(true);
    }
  });
});

describe("FR-VET-003 · rubric validation", () => {
  const base = seedDefinition(SPARKLAB_SEED);
  it("FR-VET-003 · rejects bad bands, duplicate codes, empty sections and invalid maxima", () => {
    expect(validateRubric({ ...base, bands: [{ min: 5, outcome: "approve" }] })).toContain("the first band must start at 0");
    expect(validateRubric({ ...base, bands: [{ min: 0, outcome: "reject" }, { min: 0, outcome: "approve" }] })).toContain("band starts must increase");
    expect(validateRubric({ ...base, bands: [{ min: 0, outcome: "reject" }, { min: 81, outcome: "approve" }] })).toContain("a band starts above the maximum total");
    expect(validateRubric({ ...base, sections: [] })).toContain("no sections");
    expect(validateRubric({ ...base, sections: [{ ...base.sections[0]!, items: [] }] }).join()).toContain("has no items");
    const dup = { ...base, sections: [base.sections[0]!, base.sections[0]!] };
    expect(validateRubric(dup).join()).toContain("duplicate section");
    const badMax = { ...base, sections: [{ ...base.sections[0]!, items: [{ ...base.sections[0]!.items[0]!, max: 0 }] }] };
    expect(validateRubric(badMax).join()).toContain("max must be an integer");
  });
});

describe("FR-VET-003 / FR-VET-008 · advisory bands", () => {
  const bands: RubricBand[] = [{ min: 0, outcome: "reject" }, { min: 77, outcome: "borderline" }, { min: 98, outcome: "approve" }];
  it("FR-VET-003 · band edges: a band starts at its minimum; fractional averages fall into the band below the next minimum", () => {
    const at = (t: number) => bandFor(bands, t);
    expect([at(0), at(76), at(76.99), at(77), at(97.5), at(97.99), at(98), at(140)]).toEqual(["reject", "reject", "reject", "borderline", "borderline", "borderline", "approve", "approve"]);
  });
  it("FR-VET-003 · property: the band never improves when the total drops (monotonic)", () => {
    const rank: Record<AdvisoryOutcome, number> = { reject: 0, borderline: 1, approve: 2 };
    const r = rng(7);
    for (let i = 0; i < 500; i++) {
      const a = r() * 140, b = r() * 140;
      const [lo, hi] = a < b ? [a, b] : [b, a];
      expect(rank[bandFor(bands, lo)]).toBeLessThanOrEqual(rank[bandFor(bands, hi)]);
    }
  });
  it("FR-VET-008 · a decision differs from the band unless approve↔approved or reject↔rejected; borderline always differs", () => {
    const table: [("approved" | "rejected"), AdvisoryOutcome, boolean][] = [
      ["approved", "approve", false], ["approved", "borderline", true], ["approved", "reject", true],
      ["rejected", "reject", false], ["rejected", "borderline", true], ["rejected", "approve", true],
    ];
    for (const [d, b, expected] of table) expect(decisionDiffers(d, b), `${d} vs ${b}`).toBe(expected);
  });
  it("FR-VET-008 / FR-VET-013 · reason rules: not needed when matching; required and at least the configured minimum otherwise (whitespace does not count)", () => {
    expect(reasonProblem(false, undefined, 10)).toBeNull();
    expect(reasonProblem(true, undefined, 10)).toBe("required");
    expect(reasonProblem(true, "   ", 10)).toBe("required");
    expect(reasonProblem(true, "  short  ", 10)).toBe("too_short");
    expect(reasonProblem(true, "long enough reason", 10)).toBeNull();
    expect(reasonProblem(true, "x", 0)).toBeNull(); // minimum 0 still needs some text
    expect(reasonProblem(true, "", 0)).toBe("required");
  });
});

describe("FR-VET-005 · averaging and score validation", () => {
  it("FR-VET-005 · scores are averaged item by item; the average total equals the mean of the totals (property)", () => {
    const d = seedDefinition(LEADERSHIP_SEED);
    const r = rng(11);
    for (let i = 0; i < 100; i++) {
      const sheets = [1, 2].slice(0, 1 + Math.floor(r() * 2)).map(() => Object.fromEntries(allItems(d).map((it) => [it.code, Math.floor(r() * 5)])));
      const mean = sheets.reduce((a, s) => a + totalOf(s), 0) / sheets.length;
      expect(averageTotal(sheets)).toBeCloseTo(mean, 1);
      const avg = averageScores(sheets);
      for (const it of allItems(d)) {
        expect(avg[it.code]!).toBeGreaterThanOrEqual(Math.min(...sheets.map((s) => s[it.code]!)));
        expect(avg[it.code]!).toBeLessThanOrEqual(Math.max(...sheets.map((s) => s[it.code]!)));
      }
    }
    expect(averageScores([{ a: 4 }, { a: 1 }])).toEqual({ a: 2.5 });
    expect(averageScores([])).toEqual({});
  });
  it("FR-VET-012 · cleanScores accepts integers within each item's maximum and rejects the rest; missingItems lists the gaps in rubric order", () => {
    const d = seedDefinition(SPARKLAB_SEED);
    expect(cleanScores(d, { s1i1: 4, s2i3: 0 })).toEqual({ ok: true, scores: { s1i1: 4, s2i3: 0 } });
    expect(cleanScores(d, { s1i1: 5 })).toMatchObject({ ok: false, error: "bad_score" });
    expect(cleanScores(d, { s1i1: 2.5 })).toMatchObject({ ok: false, error: "bad_score" });
    expect(cleanScores(d, { s1i1: "3" as unknown as number })).toMatchObject({ ok: false, error: "bad_score" });
    expect(cleanScores(d, { zz: 1 })).toMatchObject({ ok: false, error: "unknown_item" });
    expect(missingItems(d, { s1i1: 1 })).toHaveLength(19);
    expect(missingItems(d, { s1i1: 1 })[0]).toBe("s1i2");
  });
});

describe("FR-VET-007 · conflict of interest (pure)", () => {
  const mgr: Record<string, string> = { applicant: "boss", report: "applicant", peer: "boss", boss: "ceo" };
  const managerOf = (id: string) => mgr[id] ?? null;
  it("FR-VET-007 · blocks self, the applicant's direct manager and the applicant's direct report; allows peers and skip-levels", () => {
    expect(conflictOfInterest("applicant", "applicant", managerOf)).toBe("self");
    expect(conflictOfInterest("applicant", "boss", managerOf)).toBe("assessor_is_manager");
    expect(conflictOfInterest("applicant", "report", managerOf)).toBe("assessor_is_report");
    expect(conflictOfInterest("applicant", "peer", managerOf)).toBeNull(); // shares a manager: allowed by FR-VET-007
    expect(conflictOfInterest("applicant", "ceo", managerOf)).toBeNull(); // skip-level: not in the rule
    expect(conflictOfInterest("applicant", "stranger", () => null)).toBeNull();
  });
  it("FR-VET-007 · property: self is always a conflict, and the manager rule is directional", () => {
    const r = rng(3);
    const ids = ["a", "b", "c", "d", "e"];
    for (let i = 0; i < 300; i++) {
      const edges: Record<string, string> = {};
      for (const x of ids) if (r() < 0.6) edges[x] = ids[Math.floor(r() * ids.length)]!;
      const m = (id: string) => edges[id] ?? null;
      const a = ids[Math.floor(r() * ids.length)]!, s = ids[Math.floor(r() * ids.length)]!;
      const out = conflictOfInterest(a, s, m);
      if (a === s) expect(out).toBe("self");
      else if (m(a) === s) expect(out).toBe("assessor_is_manager");
      else if (m(s) === a) expect(out).toBe("assessor_is_report");
      else expect(out).toBeNull();
    }
  });
});

describe("FR-VET-002 · application state machine (pure mirror of §4.1)", () => {
  it("FR-VET-002 · exactly the twelve legal transitions of the domain model are allowed", () => {
    expect(TRANSITIONS).toHaveLength(12);
    const legal = new Set(TRANSITIONS.map(([a, b]) => `${a}>${b}`));
    for (const a of STATUSES) for (const b of STATUSES) expect(canTransition(a, b), `${a}>${b}`).toBe(legal.has(`${a}>${b}`));
  });
  it("FR-VET-002 · rejected and withdrawn are terminal; approved and suspended toggle; nobody skips review", () => {
    for (const b of STATUSES) { expect(canTransition("rejected", b)).toBe(false); expect(canTransition("withdrawn", b)).toBe(false); }
    expect(canTransition("approved", "suspended") && canTransition("suspended", "approved")).toBe(true);
    expect(canTransition("draft", "approved")).toBe(false);
    expect(canTransition("submitted", "rejected")).toBe(false);
    expect(canTransition("nominated", "submitted")).toBe(false);
  });
});

describe("AC-VET-01.3 · application form completeness", () => {
  it("AC-VET-01.3 · lists the missing required parts; mentoring experience is optional; text under 20 characters does not count", () => {
    const full = { motivation: "m".repeat(20), experience: "e".repeat(20), mentoringExperience: null, commitmentConfirmed: true };
    expect(missingParts(full)).toEqual([]);
    expect(missingParts({ ...full, motivation: "m".repeat(19) })).toEqual(["motivation"]);
    expect(missingParts({ ...full, experience: null, commitmentConfirmed: false })).toEqual(["experience", "commitment"]);
    expect(missingParts({ motivation: null, experience: null, mentoringExperience: null, commitmentConfirmed: false })).toEqual(["motivation", "experience", "commitment"]);
    expect(missingParts({ ...full, motivation: "   " + "m".repeat(10) + "   " })).toEqual(["motivation"]);
  });
});

describe("FR-VET-013 · cool-off (C-151) and settings accessors", () => {
  const closed = new Date("2026-01-01T00:00:00Z");
  it("FR-VET-013 · 0 days never blocks; 180 days blocks until closed+180d (exclusive of that instant)", () => {
    expect(cooloffBlocks(closed, 0, new Date("2026-01-01T00:00:01Z"))).toBeNull();
    const until = cooloffBlocks(closed, 180, new Date("2026-06-01T00:00:00Z"));
    expect(until?.toISOString()).toBe("2026-06-30T00:00:00.000Z");
    expect(cooloffBlocks(closed, 180, new Date("2026-06-30T00:00:00Z"))).toBeNull();
    expect(cooloffBlocks(null, 180, new Date())).toBeNull();
  });
  it("FR-VET-013 · defaults are C-151 = 180 days, C-152 = 10 characters, C-153 = 3 days; overrides are clamped to the platform bounds", async () => {
    const d = await vettingSettings("o");
    expect([d.reapplyCooloffDays, d.minReasonLength, d.assessmentReminderLeadDays]).toEqual([180, 10, 3]);
    setVettingSettingsOverride(async () => ({ reapplyCooloffDays: 5000, minReasonLength: 9999, assessmentReminderLeadDays: -4 }));
    const c = await vettingSettings("o");
    setVettingSettingsOverride(undefined);
    expect(c.reapplyCooloffDays).toBe(VETTING_BOUNDS.reapplyCooloffDays.max);
    expect(c.minReasonLength).toBe(VETTING_BOUNDS.minReasonLength.max);
    expect(c.assessmentReminderLeadDays).toBe(0);
  });
});

describe("reminders seam (C-153)", () => {
  it("FR-VET-005 · the default scheduler does nothing and a registered one receives the request", async () => {
    const req = { organisationId: "o", kind: "assessment_due" as const, recipientMembershipId: "m", subjectType: "assessment" as const, subjectId: "s", remindAt: new Date() };
    await expect(scheduleReminder(req)).resolves.toBeUndefined();
    const seen: unknown[] = [];
    setReminderScheduler({ schedule: async (r) => void seen.push(r), cancel: async () => undefined });
    await scheduleReminder(req);
    setReminderScheduler(undefined);
    expect(seen).toEqual([req]);
  });
});
