import { afterEach, describe, expect, it } from "vitest";
import {
  acceptNomination, declineNomination, nominate, recordDecision, releaseDecision, reinstateMentor, saveApplicationDraft, startApplication, submitApplication, suspendMentor, withdrawApplication,
} from "../../src/domain/vetting/commands";
import { setVettingSettingsOverride } from "../../src/domain/vetting/settings";
import { exportVettingData, getMentorStatus, getMyApplication, listApprovedMentors, listMyApplications, listOpenProgrammes } from "../../src/domain/vetting/queries";
import { NotFoundError } from "../../src/lib/permissions";
import { createPerson, createProgramme } from "./factory";
import { approvedMentor, assign, ownerSql, GOOD_FORM, makeApplicant, makeAssessor, makeWorld, scoreAll, submittedApplication, withOrg } from "./vetting-world";

afterEach(() => setVettingSettingsOverride(undefined));

describe("US-VET-01 · apply or accept a nomination", () => {
  it("AC-VET-01.1 · an eligible person sees the programme in 'Mentor applications open'; closed programmes and ones they already applied to are not offered", async () => {
    const w = await makeWorld();
    const closed = await createProgramme(w.org, "sparklab");
    await ownerSql(w.org, "UPDATE programme SET status = 'closed' WHERE id = $1", [closed.programmeId]);
    const me = await makeApplicant(w);
    const open = await listOpenProgrammes(me.actor);
    expect(open.map((p) => p.programmeId)).toEqual([w.programmeId]);
    expect(open[0]!.blockedUntil).toBeNull();
    const s = await startApplication(me.actor, w.programmeId);
    expect(s.ok).toBe(true);
    expect(await listOpenProgrammes(me.actor)).toEqual([]);
  });

  it("AC-VET-01.2 · accepting a nomination makes the application a draft; declining makes it withdrawn", async () => {
    const w = await makeWorld();
    const a = await makeApplicant(w), b = await makeApplicant(w);
    const n1 = await nominate(w.pmActor, w.programmeId, a.person.membershipId);
    const n2 = await nominate(w.pmActor, w.programmeId, b.person.membershipId);
    if (!n1.ok || !n2.ok) throw new Error("nominate");
    expect((await getMyApplication(a.actor, n1.id)).status).toBe("nominated");
    await acceptNomination(a.actor, n1.id);
    expect((await getMyApplication(a.actor, n1.id)).status).toBe("draft");
    await declineNomination(b.actor, n2.id);
    expect((await getMyApplication(b.actor, n2.id)).status).toBe("withdrawn");
    // a nomination cannot be accepted twice, nor by somebody else
    await expect(acceptNomination(a.actor, n1.id)).rejects.toThrow(NotFoundError);
    await expect(acceptNomination(b.actor, n1.id)).rejects.toThrow(NotFoundError);
  });

  it("AC-VET-01.3 · a draft autosaves; submit with incomplete required parts is blocked and lists what is missing", async () => {
    const w = await makeWorld();
    const me = await makeApplicant(w);
    const s = await startApplication(me.actor, w.programmeId);
    if (!s.ok) throw new Error("start");
    const saved = await saveApplicationDraft(me.actor, s.id, { motivation: "Short" });
    expect(saved.savedAt).toBeInstanceOf(Date);
    expect((await getMyApplication(me.actor, s.id)).form.motivation).toBe("Short");
    const blocked = await submitApplication(me.actor, s.id);
    expect(blocked).toEqual({ ok: false, missing: ["motivation", "experience", "commitment"] });
    await saveApplicationDraft(me.actor, s.id, GOOD_FORM);
    // a later patch only touches the fields it carries
    await saveApplicationDraft(me.actor, s.id, { mentoringExperience: "Mentored two graduates." });
    const v = await getMyApplication(me.actor, s.id);
    expect(v.form.motivation).toBe(GOOD_FORM.motivation);
    expect(v.form.mentoringExperience).toBe("Mentored two graduates.");
    expect(await submitApplication(me.actor, s.id)).toEqual({ ok: true });
    expect((await getMyApplication(me.actor, s.id)).status).toBe("submitted");
    // once submitted the form is locked
    await expect(saveApplicationDraft(me.actor, s.id, { motivation: "changed my mind after submitting" })).rejects.toThrow(NotFoundError);
  });

  it("AC-VET-01.4 · an ineligible person, another person, or another organisation gets 'not found'", async () => {
    const w = await makeWorld();
    const draftProg = await createProgramme(w.org, "leadership");
    await ownerSql(w.org, "UPDATE programme SET status = 'closed' WHERE id = $1", [draftProg.programmeId]);
    const me = await makeApplicant(w), other = await makeApplicant(w);
    await expect(startApplication(me.actor, draftProg.programmeId)).rejects.toThrow(NotFoundError); // not accepting applications
    await expect(startApplication(me.actor, "not-a-uuid")).rejects.toThrow(NotFoundError);
    const mine = await startApplication(me.actor, w.programmeId);
    if (!mine.ok) throw new Error("start");
    await expect(getMyApplication(other.actor, mine.id)).rejects.toThrow(NotFoundError);
    await expect(saveApplicationDraft(other.actor, mine.id, { motivation: "x".repeat(30) })).rejects.toThrow(NotFoundError);
    await expect(submitApplication(other.actor, mine.id)).rejects.toThrow(NotFoundError);
    await expect(getMyApplication(me.actor, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(NotFoundError);
    // another organisation: neither its programme nor its application is reachable
    const w2 = await makeWorld();
    const foreign = await makeApplicant(w2);
    await expect(startApplication(foreign.actor, w.programmeId)).rejects.toThrow(NotFoundError);
    await expect(getMyApplication(foreign.actor, mine.id)).rejects.toThrow(NotFoundError);
    // a person deactivated after signing in is no longer eligible
    await ownerSql(w.org, "UPDATE membership SET status = 'inactive' WHERE id = $1", [other.person.membershipId]);
    await expect(startApplication(other.actor, w.programmeId)).rejects.toThrow(NotFoundError);
  });

  it("AC-VET-01.5 · a submitted application shows only its status: no assessor identity, score, band or reason anywhere in the applicant's data", async () => {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const assessor = await makeAssessor(w, "Zulfiyya Assessor");
    const aid = await assign(w, app.applicationId, assessor.person);
    await scoreAll(assessor.actor, aid, 3);
    const v = await getMyApplication(app.actor, app.applicationId);
    expect(v.status).toBe("in_review");
    const text = JSON.stringify([v, await listMyApplications(app.actor)]);
    expect(text).not.toContain("Zulfiyya");
    expect(text).not.toContain(assessor.person.membershipId);
    expect(text).not.toMatch(/s1i1|scores|advisory|reason/i);
  });
});

describe("US-VET-02 · see the outcome", () => {
  it("AC-VET-02.1 · after release the applicant sees the outcome and the feedback the PM chose to release (N-025)", async () => {
    const w = await makeWorld();
    const m = await approvedMentor(w);
    await releaseDecision(w.pmActor, m.applicationId, "Strong coaching examples; welcome to the programme.");
    const v = await getMyApplication(m.actor, m.applicationId);
    expect(v.status).toBe("approved");
    expect(v.outcome).toBe("approved");
    expect(v.feedback).toBe("Strong coaching examples; welcome to the programme.");
    // a decision can be released only once
    expect(await releaseDecision(w.pmActor, m.applicationId, "again")).toEqual({ ok: false, reason: "already_released" });
  });

  it("AC-VET-02.2 · before release the applicant sees only 'in review' (approved or rejected alike)", async () => {
    const w = await makeWorld();
    const ok = await approvedMentor(w);
    const vOk = await getMyApplication(ok.actor, ok.applicationId);
    expect(vOk.status).toBe("in_review");
    expect(vOk.outcome).toBeNull();
    expect(vOk.feedback).toBeNull();
    const bad = await submittedApplication(w);
    const asr = await makeAssessor(w);
    const aid = await assign(w, bad.applicationId, asr.person);
    await scoreAll(asr.actor, aid, 0);
    const d = await recordDecision(w.pmActor, bad.applicationId, { decision: "rejected" });
    expect(d.ok).toBe(true);
    const vBad = await getMyApplication(bad.actor, bad.applicationId);
    expect(vBad.status).toBe("in_review");
    expect(vBad.outcome).toBeNull();
    // the unreleased rejection cannot be probed through "start a new application" either
    expect(await startApplication(bad.actor, w.programmeId)).toMatchObject({ ok: false, reason: "already_open" });
    expect((await listOpenProgrammes(bad.actor)).map((p) => p.programmeId)).not.toContain(w.programmeId);
    await expect(releaseDecision(w.pmActor, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(NotFoundError);
  });

  it("AC-VET-02.3 · item-level scores are not in the decision view but are in the applicant's data export", async () => {
    const w = await makeWorld();
    const m = await approvedMentor(w, { release: true, value: 3 });
    const view = JSON.stringify(await getMyApplication(m.actor, m.applicationId));
    expect(view).not.toMatch(/s1i1|itemScores|scores/);
    const exp = await withOrg(w.org.id, (tx) => exportVettingData(tx, m.person.membershipId));
    expect(exp.applications).toHaveLength(1);
    const a = exp.applications[0]!;
    expect(a.outcome).toBe("approved");
    expect(a.assessments).toHaveLength(1);
    expect(Object.keys(a.assessments[0]!.itemScores)).toHaveLength(35);
    expect(a.assessments[0]!.itemScores.s1i1).toBe(3);
    expect(a.assessments[0]!.total).toBe(105);
    expect(JSON.stringify(exp)).not.toContain(m.assessor.person.membershipId); // assessor identity stays out
    // the export never reveals an unreleased outcome or its scores
    const pending = await approvedMentor(w, { release: false });
    const exp2 = await withOrg(w.org.id, (tx) => exportVettingData(tx, pending.person.membershipId));
    expect(exp2.applications[0]!.status).toBe("in_review");
    expect(exp2.applications[0]!.outcome).toBeNull();
    expect(exp2.applications[0]!.assessments).toEqual([]);
    // an assessor's export carries the scores they wrote
    const mine = await withOrg(w.org.id, (tx) => exportVettingData(tx, m.assessor.person.membershipId));
    expect(mine.assessmentsAuthored[0]!.itemScores.s1i1).toBe(3);
  });

  it("AC-VET-02.4 · an approved mentor becomes discoverable; a suspended one does not (and comes back on reinstatement)", async () => {
    const w = await makeWorld();
    const m = await approvedMentor(w, { name: "Aygun Mentor" });
    const status = (id: string) => withOrg(w.org.id, (tx) => getMentorStatus(tx, id));
    const list = () => withOrg(w.org.id, (tx) => listApprovedMentors(tx, w.programmeId));
    expect(await status(m.person.membershipId)).toBe("approved");
    expect((await list()).map((x) => x.displayName)).toContain("Aygun Mentor");
    const s = await suspendMentor(w.pmActor, m.applicationId, "Concern raised during the pilot review.");
    expect(s.ok).toBe(true);
    expect(await status(m.person.membershipId)).toBe("suspended");
    expect((await list()).map((x) => x.displayName)).not.toContain("Aygun Mentor");
    expect(await reinstateMentor(w.pmActor, m.applicationId)).toEqual({ ok: true });
    expect(await status(m.person.membershipId)).toBe("approved");
  });
});

describe("FR-VET-001 / FR-VET-002 · who counts as a mentor", () => {
  it("FR-VET-001 · getMentorStatus is none, pending (any live stage), approved, suspended", async () => {
    const w = await makeWorld();
    const st = (id: string) => withOrg(w.org.id, (tx) => getMentorStatus(tx, id));
    const nobody = await makeApplicant(w);
    expect(await st(nobody.person.membershipId)).toBe("none");
    const applicant = await submittedApplication(w);
    expect(await st(applicant.person.membershipId)).toBe("pending");
    const nominee = await makeApplicant(w);
    await nominate(w.pmActor, w.programmeId, nominee.person.membershipId);
    expect(await st(nominee.person.membershipId)).toBe("pending");
    const approved = await approvedMentor(w);
    expect(await st(approved.person.membershipId)).toBe("approved");
    // only approved mentors are listed (pending and nominated are not)
    const names = (await withOrg(w.org.id, (tx) => listApprovedMentors(tx, w.programmeId))).map((x) => x.membershipId);
    expect(names).toEqual([approved.person.membershipId]);
    // a withdrawn application leaves the person with status none
    await withdrawApplication(applicant.actor, applicant.applicationId);
    expect(await st(applicant.person.membershipId)).toBe("none");
  });

  it("FR-VET-001 · a PM can nominate only an active person who is not already approved or in progress; a PM cannot nominate themselves", async () => {
    const w = await makeWorld();
    const m = await approvedMentor(w);
    expect(await nominate(w.pmActor, w.programmeId, m.person.membershipId)).toEqual({ ok: false, reason: "already_approved" });
    const p = await makeApplicant(w);
    expect((await nominate(w.pmActor, w.programmeId, p.person.membershipId)).ok).toBe(true);
    expect(await nominate(w.pmActor, w.programmeId, p.person.membershipId)).toEqual({ ok: false, reason: "already_open" });
    await expect(nominate(w.pmActor, w.programmeId, w.pm.membershipId)).rejects.toThrow(NotFoundError);
    const gone = await createPerson(w.org, { status: "inactive" });
    await expect(nominate(w.pmActor, w.programmeId, gone.membershipId)).rejects.toThrow(NotFoundError);
    // not a PM: not found; PM of another programme: not found
    await expect(nominate(p.actor, w.programmeId, m.person.membershipId)).rejects.toThrow(NotFoundError);
    const other = await createProgramme(w.org, "sparklab");
    await expect(nominate(w.pmActor, other.programmeId, p.person.membershipId)).rejects.toThrow(NotFoundError);
  });
});

describe("FR-VET-013 · re-application cool-off (C-151, C-152 are settings)", () => {
  async function rejectedApplicant() {
    const w = await makeWorld();
    const app = await submittedApplication(w);
    const asr = await makeAssessor(w);
    const aid = await assign(w, app.applicationId, asr.person);
    await scoreAll(asr.actor, aid, 0);
    expect((await recordDecision(w.pmActor, app.applicationId, { decision: "rejected" })).ok).toBe(true);
    expect((await releaseDecision(w.pmActor, app.applicationId, "Please try again next year.")).ok).toBe(true);
    return { w, app };
  }

  it("FR-VET-013 · after a rejection the default 180-day cool-off blocks a new application until the shown date; later it is allowed", async () => {
    const { w, app } = await rejectedApplicant();
    const r = await startApplication(app.actor, w.programmeId);
    expect(r.ok).toBe(false);
    if (r.ok || r.reason !== "cooloff") throw new Error("expected cooloff");
    const days = (r.until.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(179.9);
    expect(days).toBeLessThan(180.1);
    const open = await listOpenProgrammes(app.actor);
    expect(open[0]!.blockedUntil?.getTime()).toBe(r.until.getTime());
    const later = await startApplication(app.actor, w.programmeId, new Date(Date.now() + 181 * 86_400_000));
    expect(later.ok).toBe(true);
    // the new application is a fresh row; the old one stays as history
    expect((await listMyApplications(app.actor)).map((a) => a.status).sort()).toEqual(["draft", "rejected"]);
  });

  it("FR-VET-013 · a cool-off setting of 0 days allows immediate re-application; withdrawn applications count too", async () => {
    setVettingSettingsOverride(async () => ({ reapplyCooloffDays: 0 }));
    const { w, app } = await rejectedApplicant();
    expect((await startApplication(app.actor, w.programmeId)).ok).toBe(true);
    setVettingSettingsOverride(undefined);
    const other = await makeApplicant(w);
    const s = await startApplication(other.actor, w.programmeId);
    if (!s.ok) throw new Error("start");
    await withdrawApplication(other.actor, s.id);
    const blocked = await startApplication(other.actor, w.programmeId);
    expect(blocked).toMatchObject({ ok: false, reason: "cooloff" });
  });

  it("FR-VET-013 · the minimum reason length is a setting: a longer minimum rejects a reason that the default accepts", async () => {
    const w = await makeWorld();
    const m = await approvedMentor(w);
    setVettingSettingsOverride(async () => ({ minReasonLength: 40 }));
    const r = await suspendMentor(w.pmActor, m.applicationId, "Ten chars+ ok");
    expect(r).toMatchObject({ ok: false, reason: "reason_too_short", minLength: 40 });
    setVettingSettingsOverride(undefined);
    expect((await suspendMentor(w.pmActor, m.applicationId, "Ten chars+ ok")).ok).toBe(true);
  });
});

describe("accessibility of own data: another applicant's application never leaks", () => {
  it("FR-VET-009 · listMyApplications returns only the caller's applications", async () => {
    const w = await makeWorld();
    const a = await submittedApplication(w), b = await submittedApplication(w);
    const mine = await listMyApplications(a.actor);
    expect(mine.map((x) => x.id)).toEqual([a.applicationId]);
    expect(mine.map((x) => x.id)).not.toContain(b.applicationId);
  });
});
