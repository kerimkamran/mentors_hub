/**
 * Mentor vetting commands (writes). Every command authorises first (denial = NotFoundError, INV-4.3), derives ownership and
 * assignment from the database (never from the request), and records an audit entry with ids and codes only (INV-3).
 * Expected business refusals (conflict, incomplete form, cool-off) are returned as results so callers can explain them;
 * they are never "not found".
 */
import { audit } from "@/lib/audit";
import { withOrg, type Tx } from "@/lib/db";
import { authorize, NotFoundError, type Actor } from "@/lib/permissions";
import { conflictOfInterest, loadManagerEdges, type ConflictReason, type ManagerLookup } from "./conflicts";
import { canBeNominated, isEligibleForProgramme } from "./eligibility";
import { appResource, holdsAssessorRole, isUuid, loadApp, notOwnApplication, orNotFound, type AppRow } from "./internal";
import { notifyVetting, programmeManagers } from "./notifications";
import { cancelReminder, scheduleReminder } from "./reminders";
import { averageTotal, bandFor, cleanScores, decisionDiffers, missingItems, reasonProblem, type AdvisoryOutcome, type Scores } from "./rubric";
import { getRubric, latestRubric } from "./rubric-store";
import { cooloffBlocks, missingParts, type ApplicationForm, type FormPart } from "./rules";
import { vettingSettings } from "./settings";
import { MAX_ASSESSORS } from "./defaults";

const auditApp = (tx: Tx, actor: Actor, action: string, id: string, status: "ok" | "denied" = "ok") =>
  audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action, objectType: "mentor_application", objectId: id, status });

// ================================================================== applicant side (US-VET-01)

export type StartResult =
  | { ok: true; id: string }
  | { ok: false; reason: "already_open"; id: string }
  | { ok: false; reason: "cooloff"; until: Date };

/** Start a new application (draft) for a programme that is accepting applications. Ineligible = "not found" (AC-VET-01.4). */
export async function startApplication(actor: Actor, programmeId: string, now = new Date()): Promise<StartResult> {
  authorize(actor, "vetting.application.apply", { programmeId, ownerMembershipId: actor.membershipId });
  if (!isUuid(programmeId)) throw new NotFoundError();
  const settings = await vettingSettings(actor.organisationId, programmeId);
  return withOrg(actor.organisationId, async (tx) => {
    if (!(await isEligibleForProgramme(tx, actor.membershipId, programmeId))) throw new NotFoundError();
    // An unreleased rejection still reads "in review" to the applicant, so it still occupies their slot: starting over (or a
    // cool-off message) would reveal the decision before the PM releases it.
    const live = await tx.query<{ id: string }>(
      `SELECT m.id FROM mentor_application m WHERE m.programme_id = $1 AND m.membership_id = $2
         AND (m.status NOT IN ('rejected', 'withdrawn') OR (m.status = 'rejected' AND NOT EXISTS (SELECT 1 FROM decision_release d WHERE d.application_id = m.id)))`,
      [programmeId, actor.membershipId],
    );
    if (live.rows[0]) return { ok: false as const, reason: "already_open" as const, id: live.rows[0].id };
    // Re-application cool-off (C-151): measured from the latest rejected or withdrawn application, neutral wording to the applicant.
    const last = await tx.query<{ closed_at: Date | null }>(
      "SELECT max(closed_at) AS closed_at FROM mentor_application WHERE programme_id = $1 AND membership_id = $2 AND status IN ('rejected', 'withdrawn')",
      [programmeId, actor.membershipId],
    );
    const until = cooloffBlocks(last.rows[0]?.closed_at ?? null, settings.reapplyCooloffDays, now);
    if (until) return { ok: false as const, reason: "cooloff" as const, until };
    const ins = await tx.query<{ id: string }>(
      `INSERT INTO mentor_application (organisation_id, programme_id, membership_id, status, source) VALUES ($1, $2, $3, 'draft', 'applied') RETURNING id`,
      [actor.organisationId, programmeId, actor.membershipId],
    );
    const id = ins.rows[0]!.id;
    await auditApp(tx, actor, "vetting.application.start", id);
    return { ok: true as const, id };
  });
}

/** The applicant's own application, in the given states; anything else is "not found". */
async function ownApp(tx: Tx, actor: Actor, id: string, states: AppRow["status"][]): Promise<AppRow> {
  const app = orNotFound(await loadApp(tx, id, true));
  authorize(actor, "vetting.application.apply", appResource(app));
  if (!states.includes(app.status)) throw new NotFoundError();
  return app;
}

/** Accept a nomination: the application becomes a draft (AC-VET-01.2). */
export async function acceptNomination(actor: Actor, id: string): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    await ownApp(tx, actor, id, ["nominated"]);
    await tx.query("UPDATE mentor_application SET status = 'draft' WHERE id = $1", [id]);
    await auditApp(tx, actor, "vetting.nomination.accept", id);
  });
}

/** Decline a nomination: the application becomes withdrawn (AC-VET-01.2). */
export async function declineNomination(actor: Actor, id: string): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    await ownApp(tx, actor, id, ["nominated"]);
    await tx.query("UPDATE mentor_application SET status = 'withdrawn', closed_at = now() WHERE id = $1", [id]);
    await auditApp(tx, actor, "vetting.nomination.decline", id);
  });
}

export type FormPatch = Partial<{ motivation: string; experience: string; mentoringExperience: string; commitmentConfirmed: boolean }>;
const MAX_TEXT = 4000;

/** Autosave of the draft (AC-VET-01.3, FR-VET-012). Only the fields present in the patch change. */
export async function saveApplicationDraft(actor: Actor, id: string, patch: FormPatch): Promise<{ savedAt: Date }> {
  for (const v of [patch.motivation, patch.experience, patch.mentoringExperience]) if (v !== undefined && v.length > MAX_TEXT) throw new NotFoundError();
  return withOrg(actor.organisationId, async (tx) => {
    await ownApp(tx, actor, id, ["draft"]);
    const r = await tx.query<{ updated_at: Date }>(
      `UPDATE mentor_application SET
         motivation = CASE WHEN $2::boolean THEN $3 ELSE motivation END,
         experience = CASE WHEN $4::boolean THEN $5 ELSE experience END,
         mentoring_experience = CASE WHEN $6::boolean THEN $7 ELSE mentoring_experience END,
         commitment_confirmed = CASE WHEN $8::boolean THEN $9 ELSE commitment_confirmed END,
         updated_at = now()
       WHERE id = $1 RETURNING updated_at`,
      [
        id,
        patch.motivation !== undefined, patch.motivation ?? null,
        patch.experience !== undefined, patch.experience ?? null,
        patch.mentoringExperience !== undefined, patch.mentoringExperience ?? null,
        patch.commitmentConfirmed !== undefined, patch.commitmentConfirmed ?? false,
      ],
    );
    return { savedAt: r.rows[0]!.updated_at };
  });
}

export type SubmitResult = { ok: true } | { ok: false; missing: FormPart[] };

/** Submit; blocked with the list of missing required parts when incomplete (AC-VET-01.3). */
export async function submitApplication(actor: Actor, id: string): Promise<SubmitResult> {
  return withOrg(actor.organisationId, async (tx) => {
    const app = await ownApp(tx, actor, id, ["draft"]);
    const form: ApplicationForm = { motivation: app.motivation, experience: app.experience, mentoringExperience: app.mentoring_experience, commitmentConfirmed: app.commitment_confirmed };
    const missing = missingParts(form);
    if (missing.length) return { ok: false as const, missing };
    await tx.query("UPDATE mentor_application SET status = 'submitted', submitted_at = now() WHERE id = $1", [id]);
    await auditApp(tx, actor, "vetting.application.submit", id);
    for (const pm of await programmeManagers(tx, app.programme_id))
      await notifyVetting(tx, { code: "N-021", organisationId: actor.organisationId, recipientMembershipId: pm, applicationId: id, programmeId: app.programme_id });
    return { ok: true as const };
  });
}

/** Withdraw a draft, submitted or in-review application (domain model §4.1). Starts the re-application cool-off. */
export async function withdrawApplication(actor: Actor, id: string): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    await ownApp(tx, actor, id, ["draft", "submitted", "in_review"]);
    await tx.query("UPDATE mentor_application SET status = 'withdrawn', closed_at = now() WHERE id = $1", [id]);
    await auditApp(tx, actor, "vetting.application.withdraw", id);
  });
}

// ================================================================== PM side

export type NominateResult = { ok: true; id: string } | { ok: false; reason: "already_approved" | "already_open" };

/** PM nominates an active person (FR-VET-001, matrix §4.5). Not allowed when the person is already approved or has a live application. */
export async function nominate(actor: Actor, programmeId: string, membershipId: string): Promise<NominateResult> {
  authorize(actor, "vetting.application.nominate", { programmeId });
  if (!isUuid(programmeId) || !isUuid(membershipId)) throw new NotFoundError();
  if (membershipId === actor.membershipId) throw new NotFoundError(); // a PM cannot nominate themselves
  return withOrg(actor.organisationId, async (tx) => {
    if (!(await canBeNominated(tx, membershipId, programmeId))) throw new NotFoundError();
    const live = await tx.query<{ id: string; status: string }>(
      "SELECT id, status FROM mentor_application WHERE programme_id = $1 AND membership_id = $2 AND status NOT IN ('rejected', 'withdrawn')",
      [programmeId, membershipId],
    );
    if (live.rows[0]) return { ok: false as const, reason: live.rows[0].status === "approved" || live.rows[0].status === "suspended" ? ("already_approved" as const) : ("already_open" as const) };
    const ins = await tx.query<{ id: string }>(
      `INSERT INTO mentor_application (organisation_id, programme_id, membership_id, status, source, nominated_by)
       VALUES ($1, $2, $3, 'nominated', 'nominated', $4) RETURNING id`,
      [actor.organisationId, programmeId, membershipId, actor.membershipId],
    );
    const id = ins.rows[0]!.id;
    await auditApp(tx, actor, "vetting.nomination.create", id);
    await notifyVetting(tx, { code: "N-020", organisationId: actor.organisationId, recipientMembershipId: membershipId, applicationId: id, programmeId });
    return { ok: true as const, id };
  });
}

export type AssignReason = "bad_state" | "no_rubric" | "not_assessor" | "duplicate" | "too_many";
export type AssignResult = { ok: true; assessmentId: string } | { ok: false; reason: "conflict"; conflict: ConflictReason } | { ok: false; reason: AssignReason };

export interface AssignDeps {
  /** Builds the reporting-line lookup for the people involved. Default reads hr_record.manager_membership_id when S2's table exists. */
  managerEdges: (tx: Tx, membershipIds: string[]) => Promise<ManagerLookup>;
  now: () => Date;
}
export const defaultAssignDeps: AssignDeps = { managerEdges: loadManagerEdges, now: () => new Date() };

/**
 * PM assigns an assessor (FR-VET-005/007). The conflict check (self, the applicant's direct manager, the applicant's direct report)
 * blocks the assignment; a blocked attempt is audited as `denied` but stores nothing. The first assignment pins the rubric
 * version and moves the application to "in review".
 */
export async function assignAssessor(actor: Actor, applicationId: string, assessorMembershipId: string, opts: { dueAt?: Date } = {}, deps: AssignDeps = defaultAssignDeps): Promise<AssignResult> {
  if (!isUuid(assessorMembershipId)) throw new NotFoundError();
  return withOrg(actor.organisationId, async (tx) => {
    const app = orNotFound(await loadApp(tx, applicationId, true));
    authorize(actor, "vetting.assessor.assign", appResource(app));
    notOwnApplication(actor, app);
    if (app.status !== "submitted" && app.status !== "in_review") return { ok: false as const, reason: "bad_state" as const };

    const prog = await tx.query<{ type: string }>("SELECT type FROM programme WHERE id = $1", [app.programme_id]);
    const rubricCode = prog.rows[0]?.type;
    if (rubricCode !== "leadership" && rubricCode !== "sparklab") return { ok: false as const, reason: "no_rubric" as const }; // Open: PM approval only

    const member = await tx.query("SELECT 1 FROM membership WHERE id = $1 AND status = 'active'", [assessorMembershipId]);
    if (!member.rowCount || !(await holdsAssessorRole(tx, assessorMembershipId, app.programme_id))) return { ok: false as const, reason: "not_assessor" as const };

    // Conflict of interest (FR-VET-007) — a pure function over the reporting lines.
    const managerOf = await deps.managerEdges(tx, [app.membership_id, assessorMembershipId]);
    const conflict = conflictOfInterest(app.membership_id, assessorMembershipId, managerOf);
    if (conflict) {
      await auditApp(tx, actor, "vetting.assessor.blocked", applicationId, "denied");
      return { ok: false as const, reason: "conflict" as const, conflict };
    }

    const existing = await tx.query<{ assessor_membership_id: string }>("SELECT assessor_membership_id FROM assessment WHERE application_id = $1", [applicationId]);
    if (existing.rows.some((x) => x.assessor_membership_id === assessorMembershipId)) return { ok: false as const, reason: "duplicate" as const };
    if (existing.rows.length >= MAX_ASSESSORS) return { ok: false as const, reason: "too_many" as const };

    let rubricId = app.rubric_version_id;
    if (!rubricId) {
      const rv = await latestRubric(tx, actor.organisationId, rubricCode);
      if (!rv) return { ok: false as const, reason: "no_rubric" as const };
      rubricId = rv.id;
      await tx.query("UPDATE mentor_application SET rubric_version_id = $2 WHERE id = $1", [applicationId, rubricId]);
    }

    const settings = await vettingSettings(actor.organisationId, app.programme_id);
    const now = deps.now();
    const dueAt = opts.dueAt ?? new Date(now.getTime() + settings.assessmentDueDays * 86_400_000);
    const ins = await tx.query<{ id: string }>(
      `INSERT INTO assessment (organisation_id, application_id, assessor_membership_id, rubric_version_id, conflict_check, due_at, assigned_by)
       VALUES ($1, $2, $3, $4, 'passed', $5, $6) RETURNING id`,
      [actor.organisationId, applicationId, assessorMembershipId, rubricId, dueAt, actor.membershipId],
    );
    const assessmentId = ins.rows[0]!.id;
    if (app.status === "submitted") await tx.query("UPDATE mentor_application SET status = 'in_review' WHERE id = $1", [applicationId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "vetting.assessor.assign", objectType: "assessment", objectId: assessmentId });
    await notifyVetting(tx, { code: "N-022", organisationId: actor.organisationId, recipientMembershipId: assessorMembershipId, applicationId, programmeId: app.programme_id });
    const remindAt = new Date(dueAt.getTime() - settings.assessmentReminderLeadDays * 86_400_000); // C-153
    if (remindAt > now)
      await scheduleReminder({ organisationId: actor.organisationId, kind: "assessment_due", recipientMembershipId: assessorMembershipId, subjectType: "assessment", subjectId: assessmentId, remindAt });
    return { ok: true as const, assessmentId };
  });
}

export type DecisionResult =
  | { ok: true; advisory: AdvisoryOutcome; differs: boolean }
  | { ok: false; reason: "bad_state" | "assessments_incomplete" }
  | { ok: false; reason: "reason_required" | "reason_too_short"; minLength: number; advisory: AdvisoryOutcome };

/**
 * PM records the decision (FR-VET-008). Needs every assessment submitted. The advisory band comes from the averaged scores;
 * a decision that differs from it (a borderline band always differs) requires a reason of at least C-152 characters.
 * The reason is PM-only; the audit entry carries codes only.
 */
export async function recordDecision(actor: Actor, applicationId: string, input: { decision: "approved" | "rejected"; reason?: string }): Promise<DecisionResult> {
  if (input.decision !== "approved" && input.decision !== "rejected") throw new NotFoundError();
  return withOrg(actor.organisationId, async (tx) => {
    const app = orNotFound(await loadApp(tx, applicationId, true));
    authorize(actor, "vetting.decision.record", appResource(app));
    notOwnApplication(actor, app);
    if (app.status !== "in_review") return { ok: false as const, reason: "bad_state" as const };
    const rows = await tx.query<{ scores: Scores; submitted_at: Date | null }>("SELECT scores, submitted_at FROM assessment WHERE application_id = $1", [applicationId]);
    if (!rows.rows.length || rows.rows.some((a) => !a.submitted_at)) return { ok: false as const, reason: "assessments_incomplete" as const };
    const rubric = orNotFound(await getRubric(tx, app.rubric_version_id ?? ""));
    const total = averageTotal(rows.rows.map((a) => a.scores));
    const advisory = bandFor(rubric.bands, total);
    const differs = decisionDiffers(input.decision, advisory);
    const settings = await vettingSettings(actor.organisationId, app.programme_id);
    const problem = reasonProblem(differs, input.reason, settings.minReasonLength);
    if (problem) return { ok: false as const, reason: problem === "required" ? ("reason_required" as const) : ("reason_too_short" as const), minLength: settings.minReasonLength, advisory };
    const reason = differs ? (input.reason ?? "").trim() : (input.reason ?? "").trim() || null;
    await tx.query(
      `UPDATE mentor_application SET status = $2::text, decision = $2::text, decision_basis = 'rubric', advisory_outcome = $3, advisory_total = $4,
         decision_reason_differs_flag = $5, decision_reason = $6, decided_by = $7, decided_at = now(),
         closed_at = CASE WHEN $2::text = 'rejected' THEN now() ELSE closed_at END
       WHERE id = $1`,
      [applicationId, input.decision, advisory, total, differs, reason, actor.membershipId],
    );
    await auditApp(tx, actor, input.decision === "approved" ? "vetting.decision.approve" : "vetting.decision.reject", applicationId);
    if (differs) await auditApp(tx, actor, "vetting.decision.differs_from_band", applicationId);
    return { ok: true as const, advisory, differs };
  });
}

/** Open programme only: approval without assessment, a recorded exception to D9 (domain model §4.1). */
export async function approveWithoutAssessment(actor: Actor, applicationId: string): Promise<{ ok: true } | { ok: false; reason: "bad_state" | "needs_assessment" }> {
  return withOrg(actor.organisationId, async (tx) => {
    const app = orNotFound(await loadApp(tx, applicationId, true));
    authorize(actor, "vetting.decision.record", appResource(app));
    notOwnApplication(actor, app);
    const prog = await tx.query<{ type: string }>("SELECT type FROM programme WHERE id = $1", [app.programme_id]);
    if (prog.rows[0]?.type !== "open") return { ok: false as const, reason: "needs_assessment" as const };
    if (app.status !== "submitted") return { ok: false as const, reason: "bad_state" as const };
    await tx.query(
      `UPDATE mentor_application SET status = 'approved', decision = 'approved', decision_basis = 'open_exception', decided_by = $2, decided_at = now() WHERE id = $1`,
      [applicationId, actor.membershipId],
    );
    await auditApp(tx, actor, "vetting.decision.open_exception", applicationId);
    return { ok: true as const };
  });
}

/** PM releases the decision with optional PM-authored feedback (FR-VET-009, N-025). Once; never contains scores. */
export async function releaseDecision(actor: Actor, applicationId: string, feedback?: string): Promise<{ ok: true } | { ok: false; reason: "bad_state" | "already_released" | "feedback_too_long" }> {
  const text = (feedback ?? "").trim();
  if (text.length > 2000) return { ok: false, reason: "feedback_too_long" };
  return withOrg(actor.organisationId, async (tx) => {
    const app = orNotFound(await loadApp(tx, applicationId, true));
    authorize(actor, "vetting.decision.release", appResource(app));
    notOwnApplication(actor, app);
    if (!app.decision) return { ok: false as const, reason: "bad_state" as const };
    const ins = await tx.query(
      `INSERT INTO decision_release (organisation_id, application_id, released_feedback, released_by) VALUES ($1, $2, $3, $4) ON CONFLICT (application_id) DO NOTHING`,
      [actor.organisationId, applicationId, text || null, actor.membershipId],
    );
    if (!ins.rowCount) return { ok: false as const, reason: "already_released" as const };
    await auditApp(tx, actor, "vetting.decision.release", applicationId);
    await notifyVetting(tx, { code: "N-025", organisationId: actor.organisationId, recipientMembershipId: app.membership_id, applicationId, programmeId: app.programme_id, outcome: app.decision });
    return { ok: true as const };
  });
}

export type SuspendResult = { ok: true; flaggedRelationships: string[] } | { ok: false; reason: "bad_state" | "reason_required" | "reason_too_short"; minLength?: number };

/**
 * Suspend an approved mentor (FR-VET-011): the mentor leaves discovery and matching at once (they are no longer "approved"),
 * their existing active relationships are flagged to the PM and not terminated. Reason is PM-only; the audit entry is a code.
 */
export async function suspendMentor(actor: Actor, applicationId: string, reason: string): Promise<SuspendResult> {
  return withOrg(actor.organisationId, async (tx) => {
    const app = orNotFound(await loadApp(tx, applicationId, true));
    authorize(actor, "vetting.mentor.suspend", appResource(app));
    notOwnApplication(actor, app);
    if (app.status !== "approved") return { ok: false as const, reason: "bad_state" as const };
    const settings = await vettingSettings(actor.organisationId, app.programme_id);
    const problem = reasonProblem(true, reason, settings.minReasonLength);
    if (problem) return { ok: false as const, reason: problem === "required" ? ("reason_required" as const) : ("reason_too_short" as const), minLength: settings.minReasonLength };
    await tx.query("UPDATE mentor_application SET status = 'suspended', suspended_at = now(), suspended_by = $2, suspension_reason = $3 WHERE id = $1", [applicationId, actor.membershipId, reason.trim()]);
    await auditApp(tx, actor, "vetting.mentor.suspend", applicationId);
    const rel = await tx.query<{ id: string }>(
      `SELECT DISTINCT r.id FROM relationship r
         JOIN relationship_member rm ON rm.relationship_id = r.id AND rm.organisation_id = r.organisation_id AND rm.role = 'mentor'
         JOIN participation p ON p.id = rm.participation_id AND p.membership_id = $1
         JOIN cohort c ON c.id = r.cohort_id AND c.programme_id = $2
       WHERE r.status IN ('active', 'paused')`,
      [app.membership_id, app.programme_id],
    );
    for (const r of rel.rows) {
      await tx.query(
        `INSERT INTO vetting_relationship_flag (organisation_id, application_id, relationship_id) VALUES ($1, $2, $3)
         ON CONFLICT (application_id, relationship_id) DO UPDATE SET resolved_at = NULL, flagged_at = now()`,
        [actor.organisationId, applicationId, r.id],
      );
      await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "vetting.mentor.relationship_flagged", objectType: "relationship", objectId: r.id });
    }
    return { ok: true as const, flaggedRelationships: rel.rows.map((r) => r.id) };
  });
}

export async function reinstateMentor(actor: Actor, applicationId: string): Promise<{ ok: true } | { ok: false; reason: "bad_state" }> {
  return withOrg(actor.organisationId, async (tx) => {
    const app = orNotFound(await loadApp(tx, applicationId, true));
    authorize(actor, "vetting.mentor.suspend", appResource(app));
    notOwnApplication(actor, app);
    if (app.status !== "suspended") return { ok: false as const, reason: "bad_state" as const };
    await tx.query("UPDATE mentor_application SET status = 'approved', suspended_at = NULL, suspended_by = NULL, suspension_reason = NULL WHERE id = $1", [applicationId]);
    await tx.query("UPDATE vetting_relationship_flag SET resolved_at = now() WHERE application_id = $1 AND resolved_at IS NULL", [applicationId]);
    await auditApp(tx, actor, "vetting.mentor.reinstate", applicationId);
    return { ok: true as const };
  });
}

// ================================================================== assessor side

/** The actor's own, still open assessment; anything else (another assessor's, submitted, withdrawn application) is "not found". */
async function ownAssessment(tx: Tx, actor: Actor, assessmentId: string, forWrite: boolean) {
  if (!isUuid(assessmentId)) throw new NotFoundError();
  const r = await tx.query<{ id: string; application_id: string; rubric_version_id: string; scores: Scores; submitted_at: Date | null; programme_id: string; app_status: string; applicant: string }>(
    `SELECT a.id, a.application_id, a.rubric_version_id, a.scores, a.submitted_at, m.programme_id, m.status AS app_status, m.membership_id AS applicant
     FROM assessment a JOIN mentor_application m ON m.id = a.application_id
     WHERE a.id = $1 AND a.assessor_membership_id = $2 ${forWrite ? "FOR UPDATE OF a" : ""}`,
    [assessmentId, actor.membershipId],
  );
  const a = orNotFound(r.rows[0]);
  authorize(actor, "vetting.assessment.submit", { programmeId: a.programme_id, assigned: true });
  if (forWrite && (a.submitted_at || a.app_status !== "in_review")) throw new NotFoundError();
  return a;
}

/** Autosave of the score form (FR-VET-012). Partial; unknown items and out-of-range scores are rejected. */
export async function saveAssessmentScores(actor: Actor, assessmentId: string, raw: Record<string, unknown>): Promise<{ ok: true; savedAt: Date } | { ok: false; error: "unknown_item" | "bad_score"; item: string }> {
  return withOrg(actor.organisationId, async (tx) => {
    const a = await ownAssessment(tx, actor, assessmentId, true);
    const rubric = orNotFound(await getRubric(tx, a.rubric_version_id));
    const cleaned = cleanScores(rubric, raw);
    if (!cleaned.ok) return cleaned;
    const merged = { ...a.scores, ...cleaned.scores };
    const r = await tx.query<{ updated_at: Date }>("UPDATE assessment SET scores = $2::jsonb WHERE id = $1 RETURNING updated_at", [assessmentId, JSON.stringify(merged)]);
    return { ok: true as const, savedAt: r.rows[0]!.updated_at };
  });
}

/** Submit: every item must be scored. After submitting, the assessor may read the other assessors' submitted scores (FR-VET-006). */
export async function submitAssessment(actor: Actor, assessmentId: string): Promise<{ ok: true } | { ok: false; missing: string[] }> {
  return withOrg(actor.organisationId, async (tx) => {
    const a = await ownAssessment(tx, actor, assessmentId, true);
    const rubric = orNotFound(await getRubric(tx, a.rubric_version_id));
    const missing = missingItems(rubric, a.scores);
    if (missing.length) return { ok: false as const, missing };
    await tx.query("UPDATE assessment SET submitted_at = now() WHERE id = $1", [assessmentId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "vetting.assessment.submit", objectType: "assessment", objectId: assessmentId });
    await cancelReminder({ organisationId: actor.organisationId, kind: "assessment_due", subjectType: "assessment", subjectId: assessmentId });
    const left = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM assessment WHERE application_id = $1 AND submitted_at IS NULL", [a.application_id]);
    if (left.rows[0]!.n === 0)
      for (const pm of await programmeManagers(tx, a.programme_id))
        await notifyVetting(tx, { code: "N-024", organisationId: actor.organisationId, recipientMembershipId: pm, applicationId: a.application_id, programmeId: a.programme_id });
    return { ok: true as const };
  });
}

// ================================================================== retention (FR-VET-010)

/**
 * Deletes assessments older than the retention period (C-102, default 24 months), counted from submission (or assignment if never
 * submitted). Idempotent; the audit entry is a code (no free text, so no count field); the caller gets the count. The data-retention slice (S13) schedules it.
 */
export async function purgeExpiredAssessments(tx: Tx, organisationId: string, now = new Date()): Promise<number> {
  const settings = await vettingSettings(organisationId);
  const r = await tx.query(
    `DELETE FROM assessment WHERE COALESCE(submitted_at, created_at) < $1::timestamptz - make_interval(months => $2::int)`,
    [now, settings.assessmentRetentionMonths],
  );
  const n = r.rowCount ?? 0;
  if (n > 0) await audit(tx, { organisationId, actorId: null, action: "vetting.assessments.purged", objectType: "assessment", objectId: null, status: "ok" });
  return n;
}
