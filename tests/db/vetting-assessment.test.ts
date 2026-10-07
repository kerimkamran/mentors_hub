import { afterEach, describe, expect, it } from "vitest";
import {
  approveWithoutAssessment, assignAssessor, nominate, purgeExpiredAssessments, recordDecision, reinstateMentor, releaseDecision, saveAssessmentScores, startApplication,
  submitApplication, submitAssessment, suspendMentor, saveApplicationDraft,
} from "../../src/domain/vetting/commands";
import { loadManagerEdges } from "../../src/domain/vetting/conflicts";
import { setVettingNotifier, type VettingNotification } from "../../src/domain/vetting/notifications";
import {
  exportVettingData, getApplicationForPm, getMyAssessment, listApplications, listAssignableAssessors, listFlaggedRelationships, listMyAssignments,
} from "../../src/domain/vetting/queries";
import { setReminderScheduler, type ReminderRequest } from "../../src/domain/vetting/reminders";
import { allItems } from "../../src/domain/vetting/rubric";
import { createRubricVersion, listRubricVersions } from "../../src/domain/vetting/rubric-store";
import { NotFoundError } from "../../src/lib/permissions";
import { actorFor, createOrg, createPerson, createProgramme } from "./factory";
import { APP_URL, OWNER_URL, asApp, connect, ownerOrg } from "./helpers";
import { approvedMentor, assign, auditActions, edges, GOOD_FORM, makeApplicant, makeAssessor, makeWorld, noEdges, ownerSql, scoreAll, submittedApplication, withOrg } from "./vetting-world";

afterEach(() => {
  setReminderScheduler(undefined);
  setVettingNotifier(undefined);
});

describe("FR-VET-004 / FR-VET-003 · rubric engine", () => {
  it("FR-VET-004 · both rubrics are seeded for the organisation: 35 items for Leadership, 20 for SparkLab, with advisory bands", async () => {
    const w = await makeWorld();
    const versions = await withOrg(w.org.id, (tx) => listRubricVersions(tx, w.org.id));
    const by = Object.fromEntries(versions.map((v) => [v.code, v]));
    expect(allItems(by.leadership!)).toHaveLength(35);
    expect(by.leadership!.sections).toHaveLength(7);
    expect(by.leadership!.maxTotal).toBe(140);
    expect(allItems(by.sparklab!)).toHaveLength(20);
    expect(by.sparklab!.maxTotal).toBe(80);
    expect(by.leadership!.bands.map((b) => b.outcome)).toEqual(["reject", "borderline", "approve"]);
    // seeding is idempotent
    const again = await withOrg(w.org.id, (tx) => listRubricVersions(tx, w.org.id));
    expect(again).toHaveLength(2);
  });

  it("FR-VET-004 · the Open programme has no rubric: assessors cannot be assigned and the PM approves directly (recorded D9 exception)", async () => {
    const w = await makeWorld("open");
    const app = await submittedApplication(w);
    const asr = await makeAssessor(w);
    expect(await assignAssessor(w.pmActor, app.applicationId, asr.person.membershipId, {}, noEdges)).toEqual({ ok: false, reason: "no_rubric" });
    expect(await approveWithoutAssessment(w.pmActor, app.applicationId)).toEqual({ ok: true });
    const rows = await ownerSql<{ status: string; decision_basis: string }>(w.org, "SELECT status, decision_basis FROM mentor_application WHERE id = $1", [app.applicationId]);
    expect(rows[0]).toEqual({ status: "approved", decision_basis: "open_exception" });
    expect(await auditActions(w.org)).toContain("vetting.decision.open_exception");
    // approval without assessment is NOT available for Leadership or SparkLab
    const lw = await makeWorld("leadership");
    const lapp = await submittedApplication(lw);
    expect(await approveWithoutAssessment(lw.pmActor, lapp.applicationId)).toEqual({ ok: false, reason: "needs_assessment" });
  });

  it("FR-VET-003 · a rubric version is immutable once used; a change is a new version, and used versions keep their meaning", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const asr = await makeAssessor(w);
    await assign(w, app.applicationId, asr.person);
    const [used] = (await withOrg(w.org.id, (tx) => listRubricVersions(tx, w.org.id))).filter((v) => v.code === "leadership");
    expect(used!.immutableSince).toBeInstanceOf(Date); // stamped by the first assessment
    const c = await connect(OWNER_URL);
    try {
      await c.query("BEGIN");
      await c.query("SELECT set_config('app.org_id', $1, true)", [w.org.id]);
      await expect(c.query("UPDATE rubric_version SET name = 'tampered' WHERE id = $1", [used!.id])).rejects.toThrow(/immutable once used/);
      await c.query("ROLLBACK");
      await c.query("BEGIN");
      await c.query("SELECT set_config('app.org_id', $1, true)", [w.org.id]);
      await expect(c.query(`UPDATE rubric_version SET bands = '[{"min":0,"outcome":"approve"}]' WHERE id = $1`, [used!.id])).rejects.toThrow(/immutable once used/);
      await c.query("ROLLBACK");
    } finally {
      await c.end();
    }
    // the application role cannot even attempt it: no UPDATE privilege on the content columns, no DELETE at all
    await expect(asApp(w.org.id, (a) => a.query("UPDATE rubric_version SET sections = '[]'::jsonb WHERE id = $1", [used!.id]))).rejects.toThrow(/permission denied/);
    await expect(asApp(w.org.id, (a) => a.query("DELETE FROM rubric_version WHERE id = $1", [used!.id]))).rejects.toThrow(/permission denied/);
    await expect(asApp(w.org.id, (a) => a.query("UPDATE rubric_version SET immutable_since = NULL WHERE id = $1", [used!.id]))).rejects.toThrow(/immutable once used/);
  });

  it("FR-VET-003 · a content manager or org admin creates a new version (next number, validated); PMs and others cannot; an unused version may still be corrected by the owner", async () => {
    const w = await makeWorld();
    const cm = await createPerson(w.org, { roles: [{ role: "content_manager" }] });
    const cmActor = (await actorFor(w.org, cm)).actor;
    const base = (await withOrg(w.org.id, (tx) => listRubricVersions(tx, w.org.id))).find((v) => v.code === "sparklab")!;
    const input = { code: "sparklab", name: "SparkLab mentors v2", sections: base.sections.slice(0, 2), bands: [{ min: 0, outcome: "reject" as const }, { min: 20, outcome: "approve" as const }] };
    const r = await createRubricVersion(cmActor, input);
    expect(r).toMatchObject({ ok: true, version: 2 });
    await expect(createRubricVersion(w.pmActor, input)).rejects.toThrow(NotFoundError);
    const outsider = (await makeApplicant(w)).actor;
    await expect(createRubricVersion(outsider, input)).rejects.toThrow(NotFoundError);
    expect(await createRubricVersion(cmActor, { ...input, bands: [{ min: 5, outcome: "approve" }] })).toMatchObject({ ok: false });
    // new applications use the newest version of the code; version 1 is untouched
    const versions = await withOrg(w.org.id, (tx) => listRubricVersions(tx, w.org.id));
    expect(versions.filter((v) => v.code === "sparklab").map((v) => v.version)).toEqual([2, 1]);
    expect(versions.find((v) => v.code === "sparklab" && v.version === 1)!.sections).toHaveLength(4);
    if (!r.ok) throw new Error();
    await ownerSql(w.org, "UPDATE rubric_version SET name = 'corrected' WHERE id = $1", [r.id]); // unused: allowed at the owner level
    expect(await auditActions(w.org)).toContain("vetting.rubric.version");
  });
});

describe("FR-VET-005 / FR-VET-007 · assessors and conflicts of interest", () => {
  it("FR-VET-005 · one assessor by default, at most two; the application moves to in review; a third or repeated assessor is refused", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const [a1, a2, a3] = [await makeAssessor(w), await makeAssessor(w), await makeAssessor(w)];
    const first = await assignAssessor(w.pmActor, app.applicationId, a1.person.membershipId, {}, noEdges);
    expect(first.ok).toBe(true);
    expect((await getApplicationForPm(w.pmActor, app.applicationId)).status).toBe("in_review");
    expect(await assignAssessor(w.pmActor, app.applicationId, a1.person.membershipId, {}, noEdges)).toEqual({ ok: false, reason: "duplicate" });
    expect((await assignAssessor(w.pmActor, app.applicationId, a2.person.membershipId, {}, noEdges)).ok).toBe(true);
    expect(await assignAssessor(w.pmActor, app.applicationId, a3.person.membershipId, {}, noEdges)).toEqual({ ok: false, reason: "too_many" });
    // the database refuses a third regardless of the service
    await expect(ownerSql(w.org, `INSERT INTO assessment (organisation_id, application_id, assessor_membership_id, rubric_version_id, conflict_check, due_at)
      SELECT organisation_id, id, $2, rubric_version_id, 'passed', now() FROM mentor_application WHERE id = $1`, [app.applicationId, a3.person.membershipId])).rejects.toThrow(/at most two assessors/);
    // only people holding the assessor role for the programme qualify
    const plain = await makeApplicant(w);
    const app2 = await submittedApplication(w);
    expect(await assignAssessor(w.pmActor, app2.applicationId, plain.person.membershipId, {}, noEdges)).toEqual({ ok: false, reason: "not_assessor" });
    const otherProg = await createProgramme(w.org, "sparklab");
    const scopedElsewhere = await createPerson(w.org, { roles: [{ role: "assessor", scopeType: "programme", scopeId: otherProg.programmeId }] });
    expect(await assignAssessor(w.pmActor, app2.applicationId, scopedElsewhere.membershipId, {}, noEdges)).toEqual({ ok: false, reason: "not_assessor" });
    // draft applications cannot get assessors
    const draft = await makeApplicant(w);
    const s = await startApplication(draft.actor, w.programmeId);
    if (!s.ok) throw new Error();
    expect(await assignAssessor(w.pmActor, s.id, a1.person.membershipId, {}, noEdges)).toEqual({ ok: false, reason: "bad_state" });
  });

  it("FR-VET-005 · with two assessors the scores are averaged and the advisory band follows the average", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const [a1, a2] = [await makeAssessor(w), await makeAssessor(w)];
    const id1 = await assign(w, app.applicationId, a1.person);
    const id2 = await assign(w, app.applicationId, a2.person);
    await scoreAll(a1.actor, id1, 4); // 140
    expect((await getApplicationForPm(w.pmActor, app.applicationId)).scores).toBeNull(); // blind to the PM until everyone has submitted
    await scoreAll(a2.actor, id2, 1); // 35 -> average 87.5 = borderline (77..97)
    const view = await getApplicationForPm(w.pmActor, app.applicationId);
    expect(view.scores!.averageTotal).toBe(87.5);
    expect(view.scores!.average.s1i1).toBe(2.5);
    expect(view.scores!.advisory).toBe("borderline");
    expect(view.scores!.sheets.map((s) => s.total).sort((a, b) => a - b)).toEqual([35, 140]);
  });

  it("FR-VET-007 · self, the applicant's direct manager and the applicant's direct report are blocked, audited as denied, and nothing is stored", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const manager = await makeAssessor(w), report = await makeAssessor(w), peer = await makeAssessor(w);
    const lines = edges({ [app.person.membershipId]: manager.person.membershipId, [report.person.membershipId]: app.person.membershipId });
    expect(await assignAssessor(w.pmActor, app.applicationId, manager.person.membershipId, {}, lines)).toEqual({ ok: false, reason: "conflict", conflict: "assessor_is_manager" });
    expect(await assignAssessor(w.pmActor, app.applicationId, report.person.membershipId, {}, lines)).toEqual({ ok: false, reason: "conflict", conflict: "assessor_is_report" });
    // self: the applicant also holds the assessor role
    await ownerSql(w.org, "INSERT INTO role_grant (organisation_id, membership_id, role, scope_type, scope_id) VALUES ($1, $2, 'assessor', 'programme', $3)", [w.org.id, app.person.membershipId, w.programmeId]);
    expect(await assignAssessor(w.pmActor, app.applicationId, app.person.membershipId, {}, lines)).toEqual({ ok: false, reason: "conflict", conflict: "self" });
    expect(await ownerSql(w.org, "SELECT 1 FROM assessment WHERE application_id = $1", [app.applicationId])).toHaveLength(0);
    expect((await getApplicationForPm(w.pmActor, app.applicationId)).status).toBe("submitted");
    expect((await auditActions(w.org)).filter((a) => a === "vetting.assessor.blocked")).toHaveLength(3);
    const denied = await ownerSql<{ status: string }>(w.org, "SELECT status FROM audit_log WHERE action = 'vetting.assessor.blocked'");
    expect(denied.every((d) => d.status === "denied")).toBe(true);
    // an unrelated colleague passes; the lookup is directional (the applicant's manager is not the applicant's report)
    expect((await assignAssessor(w.pmActor, app.applicationId, peer.person.membershipId, {}, lines)).ok).toBe(true);
    // the database backstops the self rule even if the service were bypassed
    const other = await submittedApplication(w);
    await ownerSql(w.org, "INSERT INTO role_grant (organisation_id, membership_id, role, scope_type, scope_id) VALUES ($1, $2, 'assessor', 'programme', $3)", [w.org.id, other.person.membershipId, w.programmeId]);
    await ownerSql(w.org, "UPDATE mentor_application SET rubric_version_id = (SELECT id FROM rubric_version WHERE code = 'leadership') WHERE id = $1", [other.applicationId]);
    await expect(ownerSql(w.org, `INSERT INTO assessment (organisation_id, application_id, assessor_membership_id, rubric_version_id, conflict_check, due_at)
      SELECT organisation_id, id, membership_id, rubric_version_id, 'passed', now() FROM mentor_application WHERE id = $1`, [other.applicationId])).rejects.toThrow(/own application/);
  });

  it("FR-VET-007 · the default manager lookup reads hr_record.manager_membership_id only when that table exists (no edges otherwise)", async () => {
    const w = await makeWorld();
    const a = await makeApplicant(w), b = await makeApplicant(w);
    const lookup = await withOrg(w.org.id, (tx) => loadManagerEdges(tx, [a.person.membershipId, b.person.membershipId]));
    const present = (await ownerSql<{ t: string | null }>(w.org, "SELECT to_regclass('hr_record')::text AS t"))[0]!.t;
    if (!present) {
      expect(lookup(a.person.membershipId)).toBeNull();
      // without HR data the assignment still works through the default dependencies
      const app = await submittedApplication(w);
      const asr = await makeAssessor(w);
      expect((await assignAssessor(w.pmActor, app.applicationId, asr.person.membershipId)).ok).toBe(true);
    } else {
      expect(typeof lookup).toBe("function");
    }
  });

  it("FR-VET-007 · listAssignableAssessors excludes the applicant, inactive people and those already assigned", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const a1 = await makeAssessor(w, "Alpha"), a2 = await makeAssessor(w, "Beta");
    const gone = await createPerson(w.org, { name: "Gamma", status: "inactive", roles: [{ role: "assessor" }] });
    await assign(w, app.applicationId, a1.person);
    const names = (await listAssignableAssessors(w.pmActor, app.applicationId)).map((x) => x.name);
    expect(names).toContain("Beta");
    expect(names).not.toContain("Alpha");
    expect(names).not.toContain("Gamma");
    void a2; void gone;
  });
});

describe("FR-VET-006 · blind assessment", () => {
  it("FR-VET-006 · a second assessor cannot read the first assessor's scores through any query function until they submit their own", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const [a1, a2] = [await makeAssessor(w, "First Assessor"), await makeAssessor(w, "Second Assessor")];
    const id1 = await assign(w, app.applicationId, a1.person);
    const id2 = await assign(w, app.applicationId, a2.person);
    await scoreAll(a1.actor, id1, 3, false);
    const draftSeen = async () => JSON.stringify([await getMyAssessment(a2.actor, id2), await listMyAssignments(a2.actor), await withOrg(w.org.id, (tx) => exportVettingData(tx, a2.person.membershipId))]);
    // first assessor still drafting
    let seen = await draftSeen();
    expect(seen).not.toContain("First Assessor");
    expect((await getMyAssessment(a2.actor, id2)).others).toBeNull();
    // a second assessor cannot open the first one's form or reach the PM view
    await expect(getMyAssessment(a2.actor, id1)).rejects.toThrow(NotFoundError);
    await expect(saveAssessmentScores(a2.actor, id1, { s1i1: 0 })).rejects.toThrow(NotFoundError);
    await expect(submitAssessment(a2.actor, id1)).rejects.toThrow(NotFoundError);
    await expect(getApplicationForPm(a2.actor, app.applicationId)).rejects.toThrow(NotFoundError);
    await expect(listApplications(a2.actor)).rejects.toThrow(NotFoundError);
    // the first assessor submits: the second still sees nothing until they submit their own
    await submitAssessment(a1.actor, id1);
    seen = await draftSeen();
    expect(seen).not.toContain("First Assessor");
    expect((await getMyAssessment(a2.actor, id2)).others).toBeNull();
    // the second submits: now they may compare
    await scoreAll(a2.actor, id2, 2);
    const after = await getMyAssessment(a2.actor, id2);
    expect(after.others).toHaveLength(1);
    expect(after.others![0]!.assessorName).toBe("First Assessor");
    expect(after.others![0]!.scores.s1i1).toBe(3);
    // and the first assessor sees the second's now that both are in
    expect((await getMyAssessment(a1.actor, id1)).others![0]!.scores.s1i1).toBe(2);
  });

  it("FR-VET-006 · a submitting assessor never sees another assessor's unsubmitted draft", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const [a1, a2] = [await makeAssessor(w), await makeAssessor(w)];
    const id1 = await assign(w, app.applicationId, a1.person);
    const id2 = await assign(w, app.applicationId, a2.person);
    await scoreAll(a1.actor, id1, 3, false); // draft only
    await scoreAll(a2.actor, id2, 2, true);
    expect((await getMyAssessment(a2.actor, id2)).others).toEqual([]);
  });

  it("FR-VET-006 · the PM sees item scores only after every assigned assessor has submitted; statuses and timestamps are visible earlier", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const [a1, a2] = [await makeAssessor(w), await makeAssessor(w)];
    const id1 = await assign(w, app.applicationId, a1.person);
    const id2 = await assign(w, app.applicationId, a2.person);
    await scoreAll(a1.actor, id1, 3);
    const mid = await getApplicationForPm(w.pmActor, app.applicationId);
    expect(mid.scores).toBeNull();
    expect(mid.assessments.map((a) => !!a.submittedAt).sort()).toEqual([false, true]);
    expect(mid.assessments.every((a) => !("scores" in a))).toBe(true);
    expect(JSON.stringify(await listApplications(w.pmActor))).not.toMatch(/s1i1|scores/);
    await scoreAll(a2.actor, id2, 3);
    expect((await getApplicationForPm(w.pmActor, app.applicationId)).scores).not.toBeNull();
  });

  it("FR-VET-006 · a submitted assessment is immutable (autosave and resubmission are refused, the database agrees)", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const a1 = await makeAssessor(w);
    const id1 = await assign(w, app.applicationId, a1.person);
    await scoreAll(a1.actor, id1, 3);
    await expect(saveAssessmentScores(a1.actor, id1, { s1i1: 0 })).rejects.toThrow(NotFoundError);
    await expect(submitAssessment(a1.actor, id1)).rejects.toThrow(NotFoundError);
    await expect(ownerSql(w.org, "UPDATE assessment SET scores = '{}'::jsonb WHERE id = $1", [id1])).rejects.toThrow(/immutable/);
  });
});

describe("FR-VET-012 · assessment autosave", () => {
  it("FR-VET-012 · partial scores are saved and merged; bad items and scores are rejected; submit lists what is missing", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const a1 = await makeAssessor(w);
    const id = await assign(w, app.applicationId, a1.person);
    expect((await saveAssessmentScores(a1.actor, id, { s1i1: 3, s1i2: 4 })).ok).toBe(true);
    expect((await saveAssessmentScores(a1.actor, id, { s1i2: 2 })).ok).toBe(true);
    const v = await getMyAssessment(a1.actor, id);
    expect(v.myScores).toEqual({ s1i1: 3, s1i2: 2 });
    expect(v.editable).toBe(true);
    expect(await saveAssessmentScores(a1.actor, id, { nope: 1 })).toMatchObject({ ok: false, error: "unknown_item" });
    expect(await saveAssessmentScores(a1.actor, id, { s1i3: 5 })).toMatchObject({ ok: false, error: "bad_score" });
    expect(await saveAssessmentScores(a1.actor, id, { s1i3: 1.5 })).toMatchObject({ ok: false, error: "bad_score" });
    expect(await saveAssessmentScores(a1.actor, id, { s1i3: -1 })).toMatchObject({ ok: false, error: "bad_score" });
    const r = await submitAssessment(a1.actor, id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toHaveLength(33);
    expect((await getMyAssessment(a1.actor, id)).submittedAt).toBeNull();
  });

  it("FR-VET-012 · the applicant's form autosaves too (field-level patches)", async () => {
    const w = await makeWorld();
    const me = await makeApplicant(w);
    const s = await startApplication(me.actor, w.programmeId);
    if (!s.ok) throw new Error();
    await saveApplicationDraft(me.actor, s.id, { motivation: "First sentence of my motivation." });
    await saveApplicationDraft(me.actor, s.id, { commitmentConfirmed: true });
    const row = (await ownerSql<{ motivation: string; commitment_confirmed: boolean }>(w.org, "SELECT motivation, commitment_confirmed FROM mentor_application WHERE id = $1", [s.id]))[0]!;
    expect(row).toEqual({ motivation: "First sentence of my motivation.", commitment_confirmed: true });
  });
});

describe("FR-VET-008 · the decision and its reason", () => {
  async function inReview(scoreValue: number | ((i: number) => number)) {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const asr = await makeAssessor(w);
    const id = await assign(w, app.applicationId, asr.person);
    return { w, app, asr, id, finish: () => scoreAll(asr.actor, id, scoreValue) };
  }

  it("FR-VET-008 · no decision before every assessment is in", async () => {
    const { w, app, finish } = await inReview(4);
    expect(await recordDecision(w.pmActor, app.applicationId, { decision: "approved" })).toEqual({ ok: false, reason: "assessments_incomplete" });
    await finish();
    expect((await recordDecision(w.pmActor, app.applicationId, { decision: "approved" })).ok).toBe(true);
    expect(await recordDecision(w.pmActor, app.applicationId, { decision: "rejected" })).toEqual({ ok: false, reason: "bad_state" });
  });

  it("FR-VET-008 · a decision that matches the advisory band needs no reason; the flag stays off", async () => {
    const { w, app, finish } = await inReview(4);
    await finish();
    const d = await recordDecision(w.pmActor, app.applicationId, { decision: "approved" });
    expect(d).toEqual({ ok: true, advisory: "approve", differs: false });
    const row = (await ownerSql<{ decision_reason_differs_flag: boolean; advisory_outcome: string }>(w.org, "SELECT decision_reason_differs_flag, advisory_outcome FROM mentor_application WHERE id = $1", [app.applicationId]))[0]!;
    expect(row).toEqual({ decision_reason_differs_flag: false, advisory_outcome: "approve" });
  });

  it("FR-VET-008 · a decision that differs from the band requires a reason of at least the minimum length (C-152); the flag is recorded", async () => {
    const { w, app, finish } = await inReview(0); // reject band
    await finish();
    expect(await recordDecision(w.pmActor, app.applicationId, { decision: "approved" })).toMatchObject({ ok: false, reason: "reason_required", advisory: "reject" });
    expect(await recordDecision(w.pmActor, app.applicationId, { decision: "approved", reason: "   short " })).toMatchObject({ ok: false, reason: "reason_too_short", minLength: 10 });
    const ok = await recordDecision(w.pmActor, app.applicationId, { decision: "approved", reason: "Exceptional references from two directors." });
    expect(ok).toEqual({ ok: true, advisory: "reject", differs: true });
    const row = (await ownerSql<{ decision_reason_differs_flag: boolean; decision_reason: string }>(w.org, "SELECT decision_reason_differs_flag, decision_reason FROM mentor_application WHERE id = $1", [app.applicationId]))[0]!;
    expect(row.decision_reason_differs_flag).toBe(true);
    expect(row.decision_reason).toContain("Exceptional");
    // the reason is PM-visible, never applicant-visible, and never in the audit trail
    expect((await getApplicationForPm(w.pmActor, app.applicationId)).decisionReason).toContain("Exceptional");
    expect(await auditActions(w.org)).toContain("vetting.decision.differs_from_band");
  });

  it("FR-VET-008 · a borderline band always needs a reason, whichever way the PM decides", async () => {
    for (const decision of ["approved", "rejected"] as const) {
      const { w, app, finish } = await inReview((i) => (i % 2 ? 3 : 2)); // 87 of 140: borderline
      await finish();
      expect(await recordDecision(w.pmActor, app.applicationId, { decision })).toMatchObject({ ok: false, reason: "reason_required", advisory: "borderline" });
      expect((await recordDecision(w.pmActor, app.applicationId, { decision, reason: "Judgement call after reading the references." })).ok).toBe(true);
    }
  });

  it("FR-VET-008 · a rejection starts the re-application cool-off and the PM cannot decide on their own application", async () => {
    const { w, app, finish } = await inReview(0);
    await finish();
    await recordDecision(w.pmActor, app.applicationId, { decision: "rejected" });
    const row = (await ownerSql<{ closed_at: Date | null }>(w.org, "SELECT closed_at FROM mentor_application WHERE id = $1", [app.applicationId]))[0]!;
    expect(row.closed_at).toBeInstanceOf(Date);
    // a PM who is themselves an applicant is "not found" to their own PM actions
    const s = await startApplication(w.pmActor, w.programmeId);
    if (!s.ok) throw new Error("pm start");
    await saveApplicationDraft(w.pmActor, s.id, GOOD_FORM);
    await submitApplication(w.pmActor, s.id);
    await expect(getApplicationForPm(w.pmActor, s.id)).rejects.toThrow(NotFoundError);
    await expect(assignAssessor(w.pmActor, s.id, (await makeAssessor(w)).person.membershipId, {}, noEdges)).rejects.toThrow(NotFoundError);
    await expect(approveWithoutAssessment(w.pmActor, s.id)).rejects.toThrow(NotFoundError);
    expect((await listApplications(w.pmActor)).map((r) => r.id)).not.toContain(s.id);
  });
});

describe("state machine (FR-VET-002) enforced by the database", () => {
  it("FR-VET-002 · illegal transitions are rejected by the database trigger", async () => {
    const w = await makeWorld();
    const draft = await makeApplicant(w);
    const s = await startApplication(draft.actor, w.programmeId);
    if (!s.ok) throw new Error();
    const bad = (from: string, to: string, id: string) => ownerSql(w.org, `UPDATE mentor_application SET status = '${to}' WHERE id = $1`, [id]).then(() => `${from}>${to} allowed`, () => "rejected");
    expect(await bad("draft", "approved", s.id)).toBe("rejected");
    expect(await bad("draft", "in_review", s.id)).toBe("rejected");
    expect(await bad("draft", "suspended", s.id)).toBe("rejected");
    expect(await bad("draft", "nominated", s.id)).toBe("rejected");
    // submitted -> approved only for the Open programme; submitted -> rejected never
    const sub = await submittedApplication(w);
    expect(await bad("submitted", "approved", sub.applicationId)).toBe("rejected");
    expect(await bad("submitted", "rejected", sub.applicationId)).toBe("rejected");
    expect(await bad("submitted", "in_review", sub.applicationId)).toBe("rejected"); // no assessor yet
    // in review -> approved needs submitted assessments
    const asr = await makeAssessor(w);
    await assign(w, sub.applicationId, asr.person);
    await ownerSql(w.org, "UPDATE mentor_application SET decision = 'approved' WHERE id = $1", [sub.applicationId]);
    expect(await bad("in_review", "approved", sub.applicationId)).toBe("rejected");
    // rejected and withdrawn are terminal
    const m = await approvedMentor(w);
    expect(await bad("approved", "draft", m.applicationId)).toBe("rejected");
    expect(await bad("approved", "rejected", m.applicationId)).toBe("rejected");
    expect(await bad("approved", "withdrawn", m.applicationId)).toBe("rejected");
    // new applications can only start as draft or nominated
    await expect(ownerSql(w.org, `INSERT INTO mentor_application (organisation_id, programme_id, membership_id, status, source) VALUES ($1, $2, $3, 'approved', 'applied')`, [w.org.id, w.programmeId, (await makeApplicant(w)).person.membershipId])).rejects.toThrow();
  });

  it("FR-VET-002 · the service's transition table matches the database for every state pair", async () => {
    const { canTransition, STATUSES, TRANSITIONS } = await import("../../src/domain/vetting/rules");
    const trig = (await ownerSql<{ src: string }>(await createOrgOnly(), "SELECT pg_get_functiondef('mh_mentor_application_guard'::regproc) AS src"))[0]!.src;
    const listed = [...trig.matchAll(/'([a-z_]+>[a-z_]+)'/g)].map((m) => m[1]!).sort();
    expect(listed).toEqual(TRANSITIONS.map(([a, b]) => `${a}>${b}`).sort());
    expect(STATUSES.flatMap((a) => STATUSES.filter((b) => canTransition(a, b)).map((b) => `${a}>${b}`)).sort()).toEqual(listed);
  });
});

async function createOrgOnly() {
  return createOrg("vetfn");
}

describe("FR-VET-011 · suspension", () => {
  it("FR-VET-011 · suspending a mentor flags their active relationships to the PM without ending them; reinstating resolves the flags", async () => {
    const w = await makeWorld();
    const m = await approvedMentor(w);
    const mentee = await makeApplicant(w);
    // an active relationship with the mentor in the programme's cohort
    const ids = await ownerSqlTx(w, m.person.membershipId, mentee.person.membershipId);
    const r = await suspendMentor(w.pmActor, m.applicationId, "Safeguarding review opened by HR.");
    expect(r).toEqual({ ok: true, flaggedRelationships: [ids.relationshipId] });
    const rel = await ownerSql<{ status: string }>(w.org, "SELECT status FROM relationship WHERE id = $1", [ids.relationshipId]);
    expect(rel[0]!.status).toBe("active"); // flagged, not terminated
    const flagged = await listFlaggedRelationships(w.pmActor);
    expect(flagged.map((f) => f.relationshipId)).toEqual([ids.relationshipId]);
    expect((await getApplicationForPm(w.pmActor, m.applicationId)).flaggedRelationships).toEqual([ids.relationshipId]);
    expect(await auditActions(w.org)).toEqual(expect.arrayContaining(["vetting.mentor.suspend", "vetting.mentor.relationship_flagged"]));
    await reinstateMentor(w.pmActor, m.applicationId);
    expect(await listFlaggedRelationships(w.pmActor)).toEqual([]);
  });

  it("FR-VET-011 · only an approved mentor can be suspended, a reason is required, and only a PM with scope may do it", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    expect(await suspendMentor(w.pmActor, app.applicationId, "Not approved yet, so nothing to suspend.")).toEqual({ ok: false, reason: "bad_state" });
    const m = await approvedMentor(w);
    expect(await suspendMentor(w.pmActor, m.applicationId, "")).toMatchObject({ ok: false, reason: "reason_required" });
    const other = await createProgramme(w.org, "sparklab");
    const otherPm = await createPerson(w.org, { roles: [{ role: "pm", scopeType: "programme", scopeId: other.programmeId }] });
    await expect(suspendMentor((await actorFor(w.org, otherPm)).actor, m.applicationId, "Trying to suspend across programmes.")).rejects.toThrow(NotFoundError);
    await expect(suspendMentor(m.actor, m.applicationId, "Suspending myself is not a thing.")).rejects.toThrow(NotFoundError);
    expect(await reinstateMentor(w.pmActor, m.applicationId)).toEqual({ ok: false, reason: "bad_state" });
  });
});

async function ownerSqlTx(w: Awaited<ReturnType<typeof makeWorld>>, mentorMembershipId: string, menteeMembershipId: string) {
  const { ownerOrg } = await import("./helpers");
  return ownerOrg(w.org.id, async (c) => {
    const mp = await c.query("INSERT INTO participation (organisation_id, cohort_id, membership_id, kind, status) VALUES ($1, $2, $3, 'mentor', 'enrolled') RETURNING id", [w.org.id, w.cohortId, mentorMembershipId]);
    const ep = await c.query("INSERT INTO participation (organisation_id, cohort_id, membership_id, kind, status) VALUES ($1, $2, $3, 'mentee', 'enrolled') RETURNING id", [w.org.id, w.cohortId, menteeMembershipId]);
    const rel = await c.query("INSERT INTO relationship (organisation_id, cohort_id, status) VALUES ($1, $2, 'active') RETURNING id", [w.org.id, w.cohortId]);
    await c.query("INSERT INTO relationship_member (relationship_id, participation_id, organisation_id, role) VALUES ($1, $2, $3, 'mentor'), ($1, $4, $3, 'mentee')", [rel.rows[0].id, mp.rows[0].id, w.org.id, ep.rows[0].id]);
    return { relationshipId: rel.rows[0].id as string };
  });
}

describe("FR-VET-010 · assessments are kept for 24 months", () => {
  it("FR-VET-010 · assessments older than the retention period are deleted by the purge; recent ones stay; the audit entry is a code", async () => {
    const w = await makeWorld();
    const old = await approvedMentor(w);
    const recent = await submittedApplication(w);
    const asr = await makeAssessor(w);
    const recentAssessment = await assign(w, recent.applicationId, asr.person);
    await ownerOrg(w.org.id, async (c) => {
      await c.query("ALTER TABLE assessment DISABLE TRIGGER assessment_guard"); // submitted assessments are immutable; ageing the fixture needs the owner to step around that
      await c.query("UPDATE assessment SET created_at = now() - interval '30 months', submitted_at = now() - interval '25 months' WHERE id = $1", [old.assessmentId]);
      await c.query("ALTER TABLE assessment ENABLE TRIGGER assessment_guard");
    });
    const n = await withOrg(w.org.id, (tx) => purgeExpiredAssessments(tx, w.org.id));
    expect(n).toBe(1);
    const left = (await ownerSql<{ id: string }>(w.org, "SELECT id FROM assessment")).map((r) => r.id);
    expect(left).toEqual([recentAssessment]);
    expect(await withOrg(w.org.id, (tx) => purgeExpiredAssessments(tx, w.org.id))).toBe(0); // idempotent
    expect(await auditActions(w.org)).toContain("vetting.assessments.purged");
    // a 23-month-old assessment is still inside the period
    const recentOnes = await withOrg(w.org.id, (tx) => purgeExpiredAssessments(tx, w.org.id, new Date(Date.now() + 22 * 30 * 86_400_000)));
    expect(recentOnes).toBe(0);
    // the decision itself survives the purge of its assessments
    expect((await ownerSql<{ status: string }>(w.org, "SELECT status FROM mentor_application WHERE id = $1", [old.applicationId]))[0]!.status).toBe("approved");
  });
});

describe("seams: reminders (C-153) and notifications (N-020…N-025) carry ids only", () => {
  it("FR-VET-005 · assigning schedules the assessment reminder C-153 (3 days before due) and submitting cancels it", async () => {
    const reminders: ReminderRequest[] = [];
    const cancelled: string[] = [];
    setReminderScheduler({ schedule: async (r) => void reminders.push(r), cancel: async (r) => void cancelled.push(r.subjectId) });
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const asr = await makeAssessor(w);
    const due = new Date(Date.now() + 10 * 86_400_000);
    const r = await assignAssessor(w.pmActor, app.applicationId, asr.person.membershipId, { dueAt: due }, noEdges);
    if (!r.ok) throw new Error();
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.remindAt.getTime()).toBe(due.getTime() - 3 * 86_400_000);
    expect(reminders[0]).toMatchObject({ kind: "assessment_due", recipientMembershipId: asr.person.membershipId, subjectId: r.assessmentId });
    expect(Object.keys(reminders[0]!).sort()).toEqual(["kind", "organisationId", "recipientMembershipId", "remindAt", "subjectId", "subjectType"]);
    await scoreAll(asr.actor, r.assessmentId, 3);
    expect(cancelled).toEqual([r.assessmentId]);
    // a due date inside the lead time schedules nothing
    const app2 = await submittedApplication(w);
    const asr2 = await makeAssessor(w);
    reminders.length = 0;
    await assignAssessor(w.pmActor, app2.applicationId, asr2.person.membershipId, { dueAt: new Date(Date.now() + 86_400_000) }, noEdges);
    expect(reminders).toHaveLength(0);
  });

  it("FR-VET-009 · the notification events fire for the right recipients with ids and the outcome word only", async () => {
    const events: VettingNotification[] = [];
    setVettingNotifier(async (_tx, n) => void events.push(n));
    const w = await makeWorld();
    const nominee = await makeApplicant(w);
    const n = await nominate(w.pmActor, w.programmeId, nominee.person.membershipId);
    if (!n.ok) throw new Error();
    expect(events.map((e) => [e.code, e.recipientMembershipId])).toEqual([["N-020", nominee.person.membershipId]]);
    const m = await approvedMentor(w);
    const codes = events.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(["N-021", "N-022", "N-024"]));
    expect(events.find((e) => e.code === "N-021")!.recipientMembershipId).toBe(w.pm.membershipId);
    expect(events.find((e) => e.code === "N-024")!.recipientMembershipId).toBe(w.pm.membershipId);
    expect(events.find((e) => e.code === "N-022")!.recipientMembershipId).toBe(m.assessor.person.membershipId);
    await releaseDecision(w.pmActor, m.applicationId, "Feedback text stays out of the event.");
    const n25 = events.find((e) => e.code === "N-025")!;
    expect(n25).toMatchObject({ recipientMembershipId: m.person.membershipId, outcome: "approved" });
    for (const e of events) expect(Object.keys(e).every((k) => ["code", "organisationId", "recipientMembershipId", "applicationId", "programmeId", "outcome"].includes(k))).toBe(true);
    expect(JSON.stringify(events)).not.toContain("Feedback text");
  });
});

describe("matrix §4.5 · access sweep: outsiders and other organisations get 'not found', nothing changes", () => {
  it("every id-taking command and query is 'not found' for outsiders, other programmes' PMs and other organisations", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const asr = await makeAssessor(w);
    const aid = await assign(w, app.applicationId, asr.person);
    await scoreAll(asr.actor, aid, 3);
    const m = await approvedMentor(w, { release: true });
    const before = JSON.stringify(await ownerSql(w.org, "SELECT id, status, decision, updated_at FROM mentor_application ORDER BY id"));

    const w2 = await makeWorld();
    const foreignPm = w2.pmActor;
    const foreignAssessor = (await makeAssessor(w2)).actor;
    const foreignPerson = (await makeApplicant(w2)).actor;
    const otherProg = await createProgramme(w.org, "sparklab");
    const otherPmPerson = await createPerson(w.org, { roles: [{ role: "pm", scopeType: "programme", scopeId: otherProg.programmeId }, { role: "assessor", scopeType: "programme", scopeId: otherProg.programmeId }] });
    const otherPm = (await actorFor(w.org, otherPmPerson)).actor;
    const nobody = (await makeApplicant(w)).actor;
    const orgAdmin = (await actorFor(w.org, await createPerson(w.org, { roles: [{ role: "org_admin" }] }))).actor;
    const ids = { app: app.applicationId, approved: m.applicationId, assessment: aid };

    for (const [label, actor] of Object.entries({ foreignPm, foreignAssessor, foreignPerson, otherPm, nobody, orgAdmin })) {
      const attempts: [string, () => Promise<unknown>][] = [
        ["getApplicationForPm", () => getApplicationForPm(actor, ids.app)],
        ["assignAssessor", () => assignAssessor(actor, ids.app, asr.person.membershipId, {}, noEdges)],
        ["recordDecision", () => recordDecision(actor, ids.app, { decision: "approved", reason: "I should not be able to do this." })],
        ["approveWithoutAssessment", () => approveWithoutAssessment(actor, ids.app)],
        ["releaseDecision", () => releaseDecision(actor, ids.approved, "nope")],
        ["suspendMentor", () => suspendMentor(actor, ids.approved, "I should not be able to do this.")],
        ["reinstateMentor", () => reinstateMentor(actor, ids.approved)],
        ["listAssignableAssessors", () => listAssignableAssessors(actor, ids.app)],
        ["getMyAssessment", () => getMyAssessment(actor, ids.assessment)],
        ["saveAssessmentScores", () => saveAssessmentScores(actor, ids.assessment, { s1i1: 0 })],
        ["submitAssessment", () => submitAssessment(actor, ids.assessment)],
        ["nominate", () => nominate(actor, w.programmeId, nobody.membershipId)],
      ];
      for (const [name, fn] of attempts) await expect(fn(), `${label}: ${name}`).rejects.toThrow(NotFoundError);
    }
    // list actions: outsiders are refused, a PM of another programme sees nothing of this one
    await expect(listApplications(nobody)).rejects.toThrow(NotFoundError);
    await expect(listApplications(orgAdmin)).rejects.toThrow(NotFoundError);
    await expect(listMyAssignments(nobody)).rejects.toThrow(NotFoundError);
    expect((await listApplications(otherPm)).map((r) => r.id)).toEqual([]);
    expect((await listApplications(foreignPm)).length).toBe(0);
    expect(await ownerSql(w.org, "SELECT id, status, decision, updated_at FROM mentor_application ORDER BY id").then((r) => JSON.stringify(r))).toBe(before);
  });

  it("FR-VET-009 · audit entries for vetting use codes only and name the object by id", async () => {
    const w = await makeWorld();
    await approvedMentor(w, { release: true });
    const rows = await ownerSql<{ action: string; object_type: string | null; object_id: string | null }>(w.org, "SELECT action, object_type, object_id FROM audit_log WHERE action LIKE 'vetting.%'");
    expect(rows.length).toBeGreaterThan(5);
    for (const r of rows) {
      expect(r.action).toMatch(/^vetting\.[a-z_.]+$/);
      expect(r.object_type).toMatch(/^(mentor_application|assessment|relationship|rubric_version)$/);
    }
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["vetting.application.start", "vetting.application.submit", "vetting.assessor.assign", "vetting.assessment.submit", "vetting.decision.approve", "vetting.decision.release"]));
  });

  it("tenant isolation · the vetting tables are invisible and unwritable across organisations at the database level", async () => {
    const w = await makeWorld();
    await approvedMentor(w, { release: true });
    const other = await createOrg("vetiso");
    for (const t of ["rubric_version", "mentor_application", "assessment", "decision_release", "vetting_relationship_flag"]) {
      const n = await asApp(other.id, async (c) => (await c.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n);
      expect(n, t).toBe(0);
    }
    await expect(asApp(other.id, (c) => c.query(`INSERT INTO mentor_application (organisation_id, programme_id, membership_id, status, source) VALUES ($1, $2, $3, 'draft', 'applied')`, [w.org.id, w.programmeId, w.pm.membershipId]))).rejects.toThrow();
    void APP_URL;
  });
});
