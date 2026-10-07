/**
 * Mentor vetting reads. Blind assessment (FR-VET-006, INV-2) is enforced HERE, at the single place item scores are read:
 *  - an assessor reads their own scores; other assessors' SUBMITTED scores only after submitting their own;
 *  - a PM reads scores only after every assessor has submitted;
 *  - the applicant never reads scores, assessors, reasons or the advisory band (AC-VET-01.5, AC-VET-02.3);
 *  - an applicant's scores leave the system only through exportVettingData (their own data export, FR-VET-009).
 * Lists and detail views for PMs carry statuses and timestamps, never scores.
 */
import { withOrg, type Tx } from "@/lib/db";
import { authorize, NotFoundError, type Actor } from "@/lib/permissions";
import { appResource, isUuid, loadApp, managedProgrammes, notOwnApplication, orNotFound, type AppRow } from "./internal";
import { isEligibleForProgramme } from "./eligibility";
import { averageScores, averageTotal, bandFor, totalOf, type AdvisoryOutcome, type Scores } from "./rubric";
import { getRubric, type RubricVersion } from "./rubric-store";
import { cooloffBlocks, type ApplicationForm, type ApplicationStatus } from "./rules";
import { vettingSettings } from "./settings";

const formOf = (a: AppRow): ApplicationForm => ({ motivation: a.motivation, experience: a.experience, mentoringExperience: a.mentoring_experience, commitmentConfirmed: a.commitment_confirmed });

// ================================================================== applicant (SCR-16)

export interface OpenProgramme { programmeId: string; name: string; type: string; blockedUntil: Date | null }

/** Programmes accepting applications that the actor may apply to (Home card "Mentor applications open", AC-VET-01.1). */
export async function listOpenProgrammes(actor: Actor, now = new Date()): Promise<OpenProgramme[]> {
  authorize(actor, "vetting.application.apply", { ownerMembershipId: actor.membershipId });
  const settings = await vettingSettings(actor.organisationId);
  return withOrg(actor.organisationId, async (tx) => {
    const progs = await tx.query<{ id: string; name: string; type: string }>("SELECT id, name, type FROM programme WHERE status = 'active' ORDER BY name");
    const out: OpenProgramme[] = [];
    for (const p of progs.rows) {
      if (!(await isEligibleForProgramme(tx, actor.membershipId, p.id))) continue;
      const live = await tx.query(
        `SELECT 1 FROM mentor_application m WHERE m.programme_id = $1 AND m.membership_id = $2
           AND (m.status NOT IN ('rejected', 'withdrawn') OR (m.status = 'rejected' AND NOT EXISTS (SELECT 1 FROM decision_release d WHERE d.application_id = m.id)))`,
        [p.id, actor.membershipId],
      );
      if (live.rowCount) continue; // already has a live application: shown in "my applications"
      const last = await tx.query<{ closed_at: Date | null }>(
        "SELECT max(closed_at) AS closed_at FROM mentor_application WHERE programme_id = $1 AND membership_id = $2 AND status IN ('rejected', 'withdrawn')",
        [p.id, actor.membershipId],
      );
      out.push({ programmeId: p.id, name: p.name, type: p.type, blockedUntil: cooloffBlocks(last.rows[0]?.closed_at ?? null, settings.reapplyCooloffDays, now) });
    }
    return out;
  });
}

/** What the applicant is allowed to see: a display status (unreleased decisions read "in review") and nothing about assessors or scores. */
export type DisplayStatus = ApplicationStatus;
export interface ApplicantView {
  id: string;
  programmeId: string;
  programmeName: string;
  source: "applied" | "nominated";
  status: DisplayStatus;
  form: ApplicationForm;
  submittedAt: Date | null;
  /** Only once the PM has released the decision. */
  outcome: "approved" | "rejected" | null;
  feedback: string | null;
  releasedAt: Date | null;
  /** Neutral "you may apply again from" date after a rejected or withdrawn application. */
  reapplyFrom: Date | null;
}

interface ApplicantRow extends AppRow { programme_name: string; released_at: Date | null; released_feedback: string | null }

function toApplicantView(a: ApplicantRow, cooloffDays: number, now: Date): ApplicantView {
  const released = a.released_at !== null;
  const decided = a.status === "approved" || a.status === "rejected" || a.status === "suspended";
  const status: DisplayStatus = decided && !released ? "in_review" : a.status;
  return {
    id: a.id,
    programmeId: a.programme_id,
    programmeName: a.programme_name,
    source: a.source,
    status,
    form: formOf(a),
    submittedAt: a.submitted_at,
    outcome: released ? a.decision : null,
    feedback: released ? a.released_feedback : null,
    releasedAt: a.released_at,
    reapplyFrom: a.closed_at && (a.status === "rejected" || a.status === "withdrawn") ? cooloffBlocks(a.closed_at, cooloffDays, now) : null,
  };
}

// Explicit column list: the applicant read model must never select reasons, the advisory band or anything about assessors.
const APPLICANT_SQL = `
  SELECT m.id, m.programme_id, m.membership_id, m.status, m.source, m.motivation, m.experience, m.mentoring_experience, m.commitment_confirmed,
         m.submitted_at, m.decision, m.closed_at, m.created_at, p.name AS programme_name, d.released_at, d.released_feedback
  FROM mentor_application m JOIN programme p ON p.id = m.programme_id
  LEFT JOIN decision_release d ON d.application_id = m.id`;

export async function listMyApplications(actor: Actor, now = new Date()): Promise<ApplicantView[]> {
  authorize(actor, "vetting.application.read", { ownerMembershipId: actor.membershipId });
  const settings = await vettingSettings(actor.organisationId);
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<ApplicantRow>(`${APPLICANT_SQL} WHERE m.membership_id = $1 ORDER BY m.created_at DESC`, [actor.membershipId]);
    return r.rows.map((a) => toApplicantView(a, settings.reapplyCooloffDays, now));
  });
}

/** The applicant's own application. Anyone else's, another organisation's or a made-up id is "not found" (AC-VET-01.4). */
export async function getMyApplication(actor: Actor, id: string, now = new Date()): Promise<ApplicantView> {
  if (!isUuid(id)) throw new NotFoundError();
  const settings = await vettingSettings(actor.organisationId);
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<ApplicantRow>(`${APPLICANT_SQL} WHERE m.id = $1`, [id]);
    const a = orNotFound(r.rows[0]);
    authorize(actor, "vetting.decision.read", { programmeId: a.programme_id, ownerMembershipId: a.membership_id });
    if (a.membership_id !== actor.membershipId) throw new NotFoundError(); // a PM reads through getApplicationForPm, never through the applicant view
    return toApplicantView(a, settings.reapplyCooloffDays, now);
  });
}

// ================================================================== PM

export interface PmListRow {
  id: string;
  programmeId: string;
  programmeName: string;
  applicantName: string;
  status: ApplicationStatus;
  source: "applied" | "nominated";
  submittedAt: Date | null;
  assessorsAssigned: number;
  assessmentsSubmitted: number;
  released: boolean;
}

export async function listApplications(actor: Actor, filter: { programmeId?: string; status?: ApplicationStatus } = {}): Promise<PmListRow[]> {
  authorize(actor, "vetting.application.list");
  const managed = managedProgrammes(actor);
  if (managed && managed.length === 0) return [];
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ id: string; programme_id: string; programme_name: string; name: string; status: ApplicationStatus; source: "applied" | "nominated"; submitted_at: Date | null; assigned: number; done: number; released: boolean }>(
      `SELECT m.id, m.programme_id, p.name AS programme_name, pp.display_name AS name, m.status, m.source, m.submitted_at,
              (SELECT count(*)::int FROM assessment a WHERE a.application_id = m.id) AS assigned,
              (SELECT count(*)::int FROM assessment a WHERE a.application_id = m.id AND a.submitted_at IS NOT NULL) AS done,
              EXISTS (SELECT 1 FROM decision_release d WHERE d.application_id = m.id) AS released
       FROM mentor_application m
         JOIN programme p ON p.id = m.programme_id
         JOIN person_profile pp ON pp.membership_id = m.membership_id
       WHERE m.membership_id <> $1
         AND ($2::uuid[] IS NULL OR m.programme_id = ANY($2::uuid[]))
         AND ($3::uuid IS NULL OR m.programme_id = $3)
         AND ($4::text IS NULL OR m.status = $4)
       ORDER BY m.created_at DESC`,
      [actor.membershipId, managed, filter.programmeId && isUuid(filter.programmeId) ? filter.programmeId : null, filter.status ?? null],
    );
    return r.rows.map((x) => ({
      id: x.id, programmeId: x.programme_id, programmeName: x.programme_name, applicantName: x.name, status: x.status, source: x.source,
      submittedAt: x.submitted_at, assessorsAssigned: x.assigned, assessmentsSubmitted: x.done, released: x.released,
    }));
  });
}

export interface ScoreSheet { assessorName: string; scores: Scores; total: number }
export interface PmApplicationView {
  id: string;
  programmeId: string;
  programmeName: string;
  programmeType: string;
  applicantName: string;
  status: ApplicationStatus;
  source: "applied" | "nominated";
  form: ApplicationForm;
  submittedAt: Date | null;
  decision: "approved" | "rejected" | null;
  decisionBasis: "rubric" | "open_exception" | null;
  decisionReason: string | null;
  decisionDiffersFromBand: boolean;
  advisoryOutcome: AdvisoryOutcome | null;
  suspensionReason: string | null;
  rubric: RubricVersion | null;
  assessments: { id: string; assessorMembershipId: string; assessorName: string; dueAt: Date; submittedAt: Date | null }[];
  /** null until every assigned assessor has submitted (matrix §4.5). */
  scores: { sheets: ScoreSheet[]; average: Scores; averageTotal: number; advisory: AdvisoryOutcome } | null;
  release: { releasedAt: Date; feedback: string | null } | null;
  flaggedRelationships: string[];
}

export async function getApplicationForPm(actor: Actor, id: string): Promise<PmApplicationView> {
  return withOrg(actor.organisationId, async (tx) => {
    const app = orNotFound(await loadApp(tx, id));
    authorize(actor, "vetting.application.read", appResource(app)); // PM scope; an assessor or the applicant reaches their own views instead
    if (!actor.roles.some((g) => g.role === "pm")) throw new NotFoundError();
    notOwnApplication(actor, app);
    const meta = await tx.query<{ programme_name: string; type: string; applicant: string }>(
      `SELECT p.name AS programme_name, p.type, pp.display_name AS applicant FROM programme p, person_profile pp WHERE p.id = $1 AND pp.membership_id = $2`,
      [app.programme_id, app.membership_id],
    );
    const m = orNotFound(meta.rows[0]);
    const ass = await tx.query<{ id: string; assessor_membership_id: string; name: string; due_at: Date; submitted_at: Date | null; scores: Scores }>(
      `SELECT a.id, a.assessor_membership_id, pp.display_name AS name, a.due_at, a.submitted_at, a.scores
       FROM assessment a JOIN person_profile pp ON pp.membership_id = a.assessor_membership_id WHERE a.application_id = $1 ORDER BY a.created_at`,
      [id],
    );
    const rubric = app.rubric_version_id ? await getRubric(tx, app.rubric_version_id) : null;
    const allIn = ass.rows.length > 0 && ass.rows.every((a) => a.submitted_at);
    let scores: PmApplicationView["scores"] = null;
    if (allIn && rubric) {
      authorize(actor, "vetting.assessment.read.others", appResource(app));
      const all = ass.rows.map((a) => a.scores);
      scores = {
        sheets: ass.rows.map((a) => ({ assessorName: a.name, scores: a.scores, total: totalOf(a.scores) })),
        average: averageScores(all),
        averageTotal: averageTotal(all),
        advisory: bandFor(rubric.bands, averageTotal(all)),
      };
    }
    const rel = await tx.query<{ released_at: Date; released_feedback: string | null }>("SELECT released_at, released_feedback FROM decision_release WHERE application_id = $1", [id]);
    const flags = await tx.query<{ relationship_id: string }>("SELECT relationship_id FROM vetting_relationship_flag WHERE application_id = $1 AND resolved_at IS NULL", [id]);
    return {
      id, programmeId: app.programme_id, programmeName: m.programme_name, programmeType: m.type, applicantName: m.applicant, status: app.status, source: app.source,
      form: formOf(app), submittedAt: app.submitted_at, decision: app.decision, decisionBasis: app.decision_basis, decisionReason: app.decision_reason,
      decisionDiffersFromBand: app.decision_reason_differs_flag, advisoryOutcome: app.advisory_outcome, suspensionReason: app.suspension_reason, rubric,
      assessments: ass.rows.map((a) => ({ id: a.id, assessorMembershipId: a.assessor_membership_id, assessorName: a.name, dueAt: a.due_at, submittedAt: a.submitted_at })),
      scores,
      release: rel.rows[0] ? { releasedAt: rel.rows[0].released_at, feedback: rel.rows[0].released_feedback } : null,
      flaggedRelationships: flags.rows.map((f) => f.relationship_id),
    };
  });
}

/** Assessor-role holders the PM can assign for this application (role covering the programme, active, not the applicant). */
export async function listAssignableAssessors(actor: Actor, applicationId: string): Promise<{ membershipId: string; name: string }[]> {
  return withOrg(actor.organisationId, async (tx) => {
    const app = orNotFound(await loadApp(tx, applicationId));
    authorize(actor, "vetting.assessor.assign", appResource(app));
    notOwnApplication(actor, app);
    const r = await tx.query<{ membership_id: string; display_name: string }>(
      `SELECT DISTINCT m.id AS membership_id, pp.display_name
       FROM role_grant g JOIN membership m ON m.id = g.membership_id AND m.status = 'active' JOIN person_profile pp ON pp.membership_id = m.id
       WHERE g.role = 'assessor' AND m.id <> $2
         AND (g.scope_type = 'org' OR (g.scope_type = 'programme' AND g.scope_id = $1)
              OR (g.scope_type = 'cohort' AND EXISTS (SELECT 1 FROM cohort c WHERE c.id = g.scope_id AND c.programme_id = $1)))
         AND NOT EXISTS (SELECT 1 FROM assessment a WHERE a.application_id = $3 AND a.assessor_membership_id = m.id)
       ORDER BY pp.display_name`,
      [app.programme_id, app.membership_id, applicationId],
    );
    return r.rows.map((x) => ({ membershipId: x.membership_id, name: x.display_name }));
  });
}

/** Relationships of suspended mentors that await the PM's attention (FR-VET-011). */
export async function listFlaggedRelationships(actor: Actor): Promise<{ applicationId: string; relationshipId: string; mentorName: string; flaggedAt: Date }[]> {
  authorize(actor, "vetting.application.list");
  const managed = managedProgrammes(actor);
  if (managed && managed.length === 0) return [];
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ application_id: string; relationship_id: string; display_name: string; flagged_at: Date }>(
      `SELECT f.application_id, f.relationship_id, pp.display_name, f.flagged_at
       FROM vetting_relationship_flag f JOIN mentor_application m ON m.id = f.application_id JOIN person_profile pp ON pp.membership_id = m.membership_id
       WHERE f.resolved_at IS NULL AND ($1::uuid[] IS NULL OR m.programme_id = ANY($1::uuid[])) ORDER BY f.flagged_at DESC`,
      [managed],
    );
    return r.rows.map((x) => ({ applicationId: x.application_id, relationshipId: x.relationship_id, mentorName: x.display_name, flaggedAt: x.flagged_at }));
  });
}

// ================================================================== assessor

export interface AssignmentRow { assessmentId: string; applicantName: string; programmeName: string; dueAt: Date; submittedAt: Date | null; open: boolean }

/** The actor's assigned assessments (applicant name and programme only; no scores). */
export async function listMyAssignments(actor: Actor): Promise<AssignmentRow[]> {
  authorize(actor, "vetting.assessment.list.own");
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ id: string; name: string; programme_name: string; due_at: Date; submitted_at: Date | null; status: string }>(
      `SELECT a.id, pp.display_name AS name, p.name AS programme_name, a.due_at, a.submitted_at, m.status
       FROM assessment a JOIN mentor_application m ON m.id = a.application_id JOIN programme p ON p.id = m.programme_id
         JOIN person_profile pp ON pp.membership_id = m.membership_id
       WHERE a.assessor_membership_id = $1 ORDER BY a.submitted_at IS NOT NULL, a.due_at`,
      [actor.membershipId],
    );
    return r.rows.map((x) => ({ assessmentId: x.id, applicantName: x.name, programmeName: x.programme_name, dueAt: x.due_at, submittedAt: x.submitted_at, open: x.submitted_at === null && x.status === "in_review" }));
  });
}

export interface AssessmentView {
  id: string;
  applicantName: string;
  programmeName: string;
  form: ApplicationForm;
  rubric: RubricVersion;
  dueAt: Date;
  submittedAt: Date | null;
  editable: boolean;
  myScores: Scores;
  /** Other assessors' SUBMITTED scores; null until I have submitted my own (FR-VET-006). */
  others: { label: string; assessorName: string; scores: Scores; total: number }[] | null;
}

export async function getMyAssessment(actor: Actor, assessmentId: string): Promise<AssessmentView> {
  if (!isUuid(assessmentId)) throw new NotFoundError();
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<AppRow & { aid: string; rubric_version_id: string; scores: Scores; a_submitted_at: Date | null; due_at: Date; applicant: string; programme_name: string }>(
      `SELECT m.*, a.id AS aid, a.scores, a.submitted_at AS a_submitted_at, a.due_at, pp.display_name AS applicant, p.name AS programme_name
       FROM assessment a JOIN mentor_application m ON m.id = a.application_id JOIN person_profile pp ON pp.membership_id = m.membership_id JOIN programme p ON p.id = m.programme_id
       WHERE a.id = $1 AND a.assessor_membership_id = $2`,
      [assessmentId, actor.membershipId],
    );
    const a = orNotFound(r.rows[0]);
    authorize(actor, "vetting.assessment.submit", { programmeId: a.programme_id, assigned: true });
    const rubric = orNotFound(await getRubric(tx, a.rubric_version_id));
    let others: AssessmentView["others"] = null;
    if (a.a_submitted_at) {
      authorize(actor, "vetting.assessment.read.others", { programmeId: a.programme_id, assigned: true });
      const o = await tx.query<{ name: string; scores: Scores }>(
        `SELECT pp.display_name AS name, x.scores FROM assessment x JOIN person_profile pp ON pp.membership_id = x.assessor_membership_id
         WHERE x.application_id = $1 AND x.id <> $2 AND x.submitted_at IS NOT NULL ORDER BY x.created_at`,
        [a.id, assessmentId],
      );
      others = o.rows.map((x, i) => ({ label: `#${i + 2}`, assessorName: x.name, scores: x.scores, total: totalOf(x.scores) }));
    }
    return {
      id: assessmentId, applicantName: a.applicant, programmeName: a.programme_name, form: formOf(a), rubric, dueAt: a.due_at, submittedAt: a.a_submitted_at,
      editable: a.a_submitted_at === null && a.status === "in_review", myScores: a.scores, others,
    };
  });
}

// ================================================================== outcome: discoverability (US-VET-02 AC-VET-02.4, FR-VET-001, FR-VET-011)

export type MentorStatus = "approved" | "pending" | "suspended" | "none";

/**
 * Vetting status of a person. Pass a programme to ask about that programme; without one the answer covers every programme:
 * suspended anywhere wins (a suspended mentor disappears at once), then approved, then pending, otherwise none.
 * Only "approved" makes a mentor discoverable or matchable; the minimum profile (S4) is checked by the caller.
 */
export async function getMentorStatus(tx: Tx, membershipId: string, programmeId?: string): Promise<MentorStatus> {
  const r = await tx.query<{ status: ApplicationStatus }>(
    "SELECT status FROM mentor_application WHERE membership_id = $1 AND ($2::uuid IS NULL OR programme_id = $2)",
    [membershipId, programmeId ?? null],
  );
  const s = new Set(r.rows.map((x) => x.status));
  if (s.has("suspended")) return "suspended";
  if (s.has("approved")) return "approved";
  if (s.has("nominated") || s.has("draft") || s.has("submitted") || s.has("in_review")) return "pending";
  return "none";
}

/** Approved mentors of a programme (the pool the matching and discovery slices start from). Suspended mentors are not included. */
export async function listApprovedMentors(tx: Tx, programmeId: string): Promise<{ membershipId: string; displayName: string }[]> {
  if (!isUuid(programmeId)) return [];
  const r = await tx.query<{ membership_id: string; display_name: string }>(
    `SELECT m.membership_id, pp.display_name FROM mentor_application m JOIN person_profile pp ON pp.membership_id = m.membership_id
     WHERE m.programme_id = $1 AND m.status = 'approved' ORDER BY pp.display_name`,
    [programmeId],
  );
  return r.rows.map((x) => ({ membershipId: x.membership_id, displayName: x.display_name }));
}

// ================================================================== personal data export (FR-VET-009, FR-PRV-004)

export interface VettingExport {
  applications: {
    id: string;
    programmeId: string;
    source: "applied" | "nominated";
    status: DisplayStatus;
    form: ApplicationForm;
    submittedAt: Date | null;
    outcome: "approved" | "rejected" | null;
    releasedFeedback: string | null;
    releasedAt: Date | null;
    /** My item-level scores, one entry per assessor, WITHOUT assessor identities; present once the decision is released. */
    assessments: { assessor: string; rubric: { code: string; version: number }; itemScores: Scores; total: number; submittedAt: Date }[];
  }[];
  /** Assessments I wrote as an assessor. */
  assessmentsAuthored: { applicationId: string; rubric: { code: string; version: number }; itemScores: Scores; submittedAt: Date | null }[];
}

/**
 * The vetting part of a person's own data export. The caller passes the signed-in actor's own membership id (S13 does this);
 * item-level scores are included here and nowhere else (AC-VET-02.3). Scores of an application appear once its decision has been
 * released, so the export can never reveal an unreleased outcome. PM-only decision reasons are internal and not included.
 */
export async function exportVettingData(tx: Tx, membershipId: string): Promise<VettingExport> {
  const apps = await tx.query<ApplicantRow>(`${APPLICANT_SQL} WHERE m.membership_id = $1 ORDER BY m.created_at`, [membershipId]);
  const applications: VettingExport["applications"] = [];
  for (const a of apps.rows) {
    const v = toApplicantView(a, 0, new Date());
    let assessments: VettingExport["applications"][number]["assessments"] = [];
    if (a.released_at) {
      const s = await tx.query<{ scores: Scores; submitted_at: Date; code: string; version: number }>(
        `SELECT x.scores, x.submitted_at, r.code, r.version FROM assessment x JOIN rubric_version r ON r.id = x.rubric_version_id
         WHERE x.application_id = $1 AND x.submitted_at IS NOT NULL ORDER BY x.created_at`,
        [a.id],
      );
      assessments = s.rows.map((x, i) => ({ assessor: `#${i + 1}`, rubric: { code: x.code, version: x.version }, itemScores: x.scores, total: totalOf(x.scores), submittedAt: x.submitted_at }));
    }
    applications.push({ id: a.id, programmeId: a.programme_id, source: a.source, status: v.status, form: v.form, submittedAt: a.submitted_at, outcome: v.outcome, releasedFeedback: v.feedback, releasedAt: a.released_at, assessments });
  }
  const mine = await tx.query<{ application_id: string; scores: Scores; submitted_at: Date | null; code: string; version: number }>(
    `SELECT x.application_id, x.scores, x.submitted_at, r.code, r.version FROM assessment x JOIN rubric_version r ON r.id = x.rubric_version_id
     WHERE x.assessor_membership_id = $1 ORDER BY x.created_at`,
    [membershipId],
  );
  return {
    applications,
    assessmentsAuthored: mine.rows.map((x) => ({ applicationId: x.application_id, rubric: { code: x.code, version: x.version }, itemScores: x.scores, submittedAt: x.submitted_at })),
  };
}
