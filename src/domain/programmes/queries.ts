/** Programme reads. Authorized first; a programme outside the actor's scope looks exactly like a missing one. */
import { withOrg, type Tx } from "../../lib/db";
import type { EnrolmentMode, ProgrammeType, ReportSchedule } from "../../lib/constants-programmes";
import { authorize, can, NotFoundError, type Actor } from "../../lib/permissions";
import { getEffectiveSettings } from "../settings/access";
import { validateRules, isEligible, type EligibilityRule, type PersonFacts } from "./eligibility";

export interface ProgrammeRow {
  id: string;
  name: string;
  type: ProgrammeType;
  status: "draft" | "active" | "closed";
  enrolmentMode: EnrolmentMode;
  reportSchedule: ReportSchedule;
  createdAt: Date;
}
const toRow = (x: { id: string; name: string; type: ProgrammeType; status: ProgrammeRow["status"]; enrolment_mode: EnrolmentMode; report_schedule: ReportSchedule; created_at: Date }): ProgrammeRow => ({
  id: x.id, name: x.name, type: x.type, status: x.status, enrolmentMode: x.enrolment_mode, reportSchedule: x.report_schedule, createdAt: x.created_at,
});
const COLS = "id, name, type, status, enrolment_mode, report_schedule, created_at";

/** The programmes the actor may configure: all for an org admin, only their own for a PM (matrix §4.3). */
export async function listProgrammes(actor: Actor): Promise<ProgrammeRow[]> {
  authorize(actor, "programme.list");
  const r = await withOrg(actor.organisationId, (tx) => tx.query(`SELECT ${COLS} FROM programme ORDER BY created_at DESC`));
  return r.rows.map(toRow).filter((p) => can(actor, "programme.settings.read", { programmeId: p.id }));
}

export interface ProgrammeDetail extends ProgrammeRow {
  cohorts: { id: string; name: string; startDate: string | null; endDate: string | null; status: string }[];
  sponsors: { id: string; name: string; email: string; roleLabel: string }[];
  rules: EligibilityRule[];
  questions: { id: string; section: string; mode: string; scalePoints: number; text: { en: string; az: string; ru: string } }[];
}

export async function getProgramme(actor: Actor, programmeId: string): Promise<ProgrammeDetail> {
  authorize(actor, "programme.read", { programmeId });
  return withOrg(actor.organisationId, async (tx) => {
    const p = await tx.query(`SELECT ${COLS} FROM programme WHERE id = $1`, [programmeId]);
    if (!p.rows[0]) throw new NotFoundError();
    const c = await tx.query<{ id: string; name: string; start_date: string | null; end_date: string | null; status: string }>(
      "SELECT id, name, start_date::text, end_date::text, status FROM cohort WHERE programme_id = $1 ORDER BY created_at", [programmeId]);
    const s = await tx.query<{ id: string; name: string; email: string; role_label: string }>("SELECT id, name, email, role_label FROM sponsor WHERE programme_id = $1 ORDER BY created_at", [programmeId]);
    const ru = await tx.query<{ rule_type: EligibilityRule["type"]; params: Record<string, unknown> }>("SELECT rule_type, params FROM eligibility_rule WHERE programme_id = $1 ORDER BY position", [programmeId]);
    const q = await tx.query<{ id: string; section: string; mode: string; scale_points: number; text_en: string; text_az: string; text_ru: string }>(
      "SELECT id, section, mode, scale_points, text_en, text_az, text_ru FROM compatibility_question WHERE programme_id = $1 ORDER BY section, position", [programmeId]);
    return {
      ...toRow(p.rows[0]),
      cohorts: c.rows.map((x) => ({ id: x.id, name: x.name, startDate: x.start_date, endDate: x.end_date, status: x.status })),
      sponsors: s.rows.map((x) => ({ id: x.id, name: x.name, email: x.email, roleLabel: x.role_label })),
      rules: ru.rows.map((x) => ({ type: x.rule_type, ...x.params }) as EligibilityRule),
      questions: q.rows.map((x) => ({ id: x.id, section: x.section, mode: x.mode, scalePoints: x.scale_points, text: { en: x.text_en, az: x.text_az, ru: x.text_ru } })),
    };
  });
}

// ---------------------------------------------------------------- live eligible count (FR-PRG-004)
async function loadPersonFacts(tx: Tx): Promise<{ people: PersonFacts[]; hrDataAvailable: boolean }> {
  // HR facts (hire date, grade bucket) come from the people import (slice S2). If its tables are not there yet, those facts are unknown.
  const cols = await tx.query<{ table_name: string; column_name: string }>(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('hr_record', 'grade_ladder')",
  );
  const has = (t: string, c: string) => cols.rows.some((x) => x.table_name === t && x.column_name === c);
  const hire = has("hr_record", "hire_date") && has("hr_record", "membership_id");
  const grade = has("hr_record", "grade_id") && has("grade_ladder", "bucket") && has("grade_ladder", "id");
  const r = await tx.query<{ department: string | null; hire_date: Date | null; bucket: number | null }>(
    `SELECT p.department,
            ${hire ? "h.hire_date" : "NULL::date"} AS hire_date,
            ${grade ? "NULLIF(regexp_replace(g.bucket::text, '[^0-9]', '', 'g'), '')::int" : "NULL::int"} AS bucket
     FROM membership m
     JOIN person_profile p ON p.membership_id = m.id
     ${hire ? "LEFT JOIN hr_record h ON h.membership_id = m.id" : ""}
     ${hire && grade ? "LEFT JOIN grade_ladder g ON g.id = h.grade_id" : ""}
     WHERE m.status = 'active'`,
  );
  return { people: r.rows.map((x) => ({ department: x.department, hireDate: x.hire_date, gradeBucket: x.bucket })), hrDataAvailable: hire || grade };
}

export interface EligibleCount { eligible: number; total: number; hrDataAvailable: boolean }

/** How many active people satisfy `rules` (or the programme's saved rules when omitted) right now. Counts only; no names. */
export async function eligibleCount(actor: Actor, programmeId: string, rawRules?: unknown, asOf = new Date()): Promise<EligibleCount> {
  authorize(actor, "programme.config.edit", { programmeId });
  return withOrg(actor.organisationId, async (tx) => {
    const p = await tx.query("SELECT 1 FROM programme WHERE id = $1", [programmeId]);
    if (!p.rowCount) throw new NotFoundError();
    let rules: EligibilityRule[];
    if (rawRules === undefined) {
      const ru = await tx.query<{ rule_type: EligibilityRule["type"]; params: Record<string, unknown> }>("SELECT rule_type, params FROM eligibility_rule WHERE programme_id = $1 ORDER BY position", [programmeId]);
      rules = ru.rows.map((x) => ({ type: x.rule_type, ...x.params }) as EligibilityRule);
    } else {
      const v = validateRules(rawRules);
      if (!v.ok) throw new NotFoundError();
      rules = v.rules;
    }
    const { people, hrDataAvailable } = await loadPersonFacts(tx);
    return { eligible: people.filter((x) => isEligible(x, rules, asOf)).length, total: people.length, hrDataAvailable };
  });
}

/** Distinct departments to pick from when defining a department rule. */
export async function listDepartments(actor: Actor, programmeId: string): Promise<string[]> {
  authorize(actor, "programme.config.edit", { programmeId });
  const r = await withOrg(actor.organisationId, (tx) =>
    tx.query<{ department: string }>("SELECT DISTINCT department FROM person_profile WHERE department IS NOT NULL AND department <> '' ORDER BY department"),
  );
  return r.rows.map((x) => x.department);
}

// ---------------------------------------------------------------- what participants see (FR-PRG-007; matrix §4.3 "summary")
export interface ProgrammeSummary {
  id: string;
  name: string;
  type: ProgrammeType;
  status: string;
  enrolmentMode: EnrolmentMode;
  cadenceDays: number;
  rules: EligibilityRule[];
  sponsors: { name: string; roleLabel: string }[]; // names and role labels only, never emails
}

/** Rules and sponsors of a programme the actor takes part in. Never weights, factors or any other setting. */
export async function getProgrammeSummary(actor: Actor, programmeId: string): Promise<ProgrammeSummary> {
  const member = await withOrg(actor.organisationId, (tx) =>
    tx.query(
      `SELECT 1 FROM participation pa JOIN cohort k ON k.id = pa.cohort_id
       WHERE k.programme_id = $1 AND pa.membership_id = $2 AND pa.status <> 'withdrawn' LIMIT 1`,
      [programmeId, actor.membershipId],
    ),
  );
  authorize(actor, "programme.read.summary", { programmeId, isMember: (member.rowCount ?? 0) > 0 });
  return withOrg(actor.organisationId, async (tx) => {
    const p = await tx.query<{ id: string; name: string; type: ProgrammeType; status: string; enrolment_mode: EnrolmentMode }>("SELECT id, name, type, status, enrolment_mode FROM programme WHERE id = $1", [programmeId]);
    if (!p.rows[0]) throw new NotFoundError();
    const s = await tx.query<{ name: string; role_label: string }>("SELECT name, role_label FROM sponsor WHERE programme_id = $1 ORDER BY created_at", [programmeId]);
    const ru = await tx.query<{ rule_type: EligibilityRule["type"]; params: Record<string, unknown> }>("SELECT rule_type, params FROM eligibility_rule WHERE programme_id = $1 ORDER BY position", [programmeId]);
    const cadence = (await getEffectiveSettings(tx, { type: "programme", id: programmeId }, "cadence_capacity")).values.cadenceDays;
    return {
      id: p.rows[0].id, name: p.rows[0].name, type: p.rows[0].type, status: p.rows[0].status, enrolmentMode: p.rows[0].enrolment_mode, cadenceDays: cadence,
      rules: ru.rows.map((x) => ({ type: x.rule_type, ...x.params }) as EligibilityRule),
      sponsors: s.rows.map((x) => ({ name: x.name, roleLabel: x.role_label })),
    };
  });
}

// ---------------------------------------------------------------- templates
export async function listTemplates(actor: Actor): Promise<{ id: string; name: string; type: ProgrammeType }[]> {
  authorize(actor, "programme.template.list");
  const r = await withOrg(actor.organisationId, (tx) => tx.query<{ id: string; name: string; programme_type: ProgrammeType }>("SELECT id, name, programme_type FROM settings_template ORDER BY lower(name)"));
  return r.rows.map((x) => ({ id: x.id, name: x.name, type: x.programme_type }));
}
