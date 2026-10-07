/**
 * Programme writes (US-PRG-06, FR-PRG-001…008): create from template, activate/close, cohorts, sponsors, eligibility rules,
 * compatibility questionnaire definition, "save as template". Authorize first (denial = not found); audit by id and code only.
 */
import { audit } from "../../lib/audit";
import { withOrg, type Tx } from "../../lib/db";
import { ENROLMENT_MODES, PROGRAMME_TYPES, type EnrolmentMode, type ProgrammeType, type ReportSchedule } from "../../lib/constants-programmes";
import { authorize, NotFoundError, type Actor } from "../../lib/permissions";
import { ensureBaselines, getEffectiveSettings, insertVersion } from "../settings/access";
import { flagPrerequisiteProblems, validateGroup } from "../settings/registry";
import { PROGRAMME_GROUPS, SettingsRejected, type GroupId, type Problem, type Values } from "../settings/types";
import { validateRules, type EligibilityRule } from "./eligibility";
import { builtinTemplate } from "./templates";

/** A rejected programme input; nothing was written. `field` is a form field name, `code` a message-key suffix. */
export class ProgrammeInputError extends Error {
  constructor(readonly problems: { field: string; code: string; params?: Record<string, string | number> }[]) {
    super(`programme input rejected: ${problems.map((p) => `${p.field}:${p.code}`).join(", ")}`);
  }
}
const reject = (field: string, code: string, params?: Record<string, string | number>): never => {
  throw new ProgrammeInputError([{ field, code, params }]);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanName = (raw: string, field: string, max: number) => {
  const n = raw.trim().replace(/\s+/g, " ");
  if (n.length < 1) return reject(field, "required");
  if (n.length > max) return reject(field, "too_long", { max });
  return n;
};

async function programmeRow(tx: Tx, id: string): Promise<{ type: ProgrammeType; status: "draft" | "active" | "closed" }> {
  const r = await tx.query<{ type: ProgrammeType; status: "draft" | "active" | "closed" }>("SELECT type, status FROM programme WHERE id = $1", [id]);
  if (!r.rows[0]) throw new NotFoundError();
  return r.rows[0];
}

// ---------------------------------------------------------------- create
export interface CreateProgrammeInput {
  name: string;
  /** A built-in type template ("leadership" | "sparklab" | "open") or the id of a saved organisation template. */
  template: string;
}

/** Creates a DRAFT programme with its starting settings versions (v1 of each group) from a template. */
export async function createProgramme(actor: Actor, input: CreateProgrammeInput): Promise<string> {
  authorize(actor, "programme.create");
  const name = cleanName(input.name, "name", 200);
  return withOrg(actor.organisationId, async (tx) => {
    let type: ProgrammeType;
    let reportSchedule: ReportSchedule;
    let rubric: string | null = null;
    let templateId: string | null = null;
    let groups: Record<string, Values>;
    if (PROGRAMME_TYPES.includes(input.template as ProgrammeType)) {
      const b = builtinTemplate(input.template as ProgrammeType);
      ({ type, reportSchedule, groups } = b);
    } else {
      if (!UUID.test(input.template)) throw new NotFoundError();
      const t = await tx.query<{ id: string; programme_type: ProgrammeType; report_schedule: ReportSchedule; rubric_version_id: string | null }>(
        "SELECT id, programme_type, report_schedule, rubric_version_id FROM settings_template WHERE id = $1", [input.template],
      );
      if (!t.rows[0]) throw new NotFoundError();
      type = t.rows[0].programme_type; reportSchedule = t.rows[0].report_schedule; rubric = t.rows[0].rubric_version_id; templateId = t.rows[0].id;
      const items = await tx.query<{ setting_group: GroupId; values: Values }>(
        `SELECT i.setting_group, v.values FROM settings_template_item i JOIN settings_version v ON v.id = i.settings_version_id WHERE i.template_id = $1`, [templateId],
      );
      groups = builtinTemplate(type).groups;
      for (const it of items.rows) groups[it.setting_group] = it.values;
    }
    const p = await tx.query<{ id: string }>(
      `INSERT INTO programme (organisation_id, type, name, status, report_schedule, rubric_version_id, template_id, created_by)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7) RETURNING id`,
      [actor.organisationId, type, name, reportSchedule, rubric, templateId, actor.membershipId],
    );
    const id = p.rows[0]!.id;
    for (const g of PROGRAMME_GROUPS) {
      const problems = validateGroup(g, "programme", groups[g]);
      if (problems.length) throw new SettingsRejected(problems); // a stored template can never create an invalid programme
      await insertVersion(tx, { organisationId: actor.organisationId, scope: { type: "programme", id }, group: g, values: groups[g]!, createdBy: actor.membershipId });
    }
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "programme.create", objectType: "programme", objectId: id });
    return id;
  });
}

// ---------------------------------------------------------------- update / activate / close
export async function updateProgramme(actor: Actor, programmeId: string, input: { name?: string; enrolmentMode?: EnrolmentMode }): Promise<void> {
  authorize(actor, "programme.config.edit", { programmeId });
  await withOrg(actor.organisationId, async (tx) => {
    const p = await programmeRow(tx, programmeId);
    if (p.status === "closed") reject("programme", "closed");
    const sets: string[] = [], vals: unknown[] = [programmeId];
    if (input.name !== undefined) { vals.push(cleanName(input.name, "name", 200)); sets.push(`name = $${vals.length}`); }
    if (input.enrolmentMode !== undefined) {
      if (!ENROLMENT_MODES.includes(input.enrolmentMode)) reject("enrolmentMode", "option");
      if (input.enrolmentMode === "rule_based" && p.type !== "open") reject("enrolmentMode", "rule_based_open_only");
      vals.push(input.enrolmentMode); sets.push(`enrolment_mode = $${vals.length}`);
    }
    if (!sets.length) return;
    await tx.query(`UPDATE programme SET ${sets.join(", ")} WHERE id = $1`, vals);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "programme.update", objectType: "programme", objectId: programmeId });
  });
}

/** Activates a draft programme only if every settings group is valid as a set (constants §0 rule 7, FR-PRG-009). */
export async function activateProgramme(actor: Actor, programmeId: string): Promise<void> {
  authorize(actor, "programme.activate", { programmeId });
  await withOrg(actor.organisationId, async (tx) => {
    const locked = await tx.query<{ type: ProgrammeType; status: string }>("SELECT type, status FROM programme WHERE id = $1 FOR UPDATE", [programmeId]);
    if (!locked.rows[0]) throw new NotFoundError();
    if (locked.rows[0].status !== "draft") reject("programme", "illegal_transition");
    const problems: Problem[] = [];
    const prereq = await tx.query<{ code: "dpia_signoff" | "storage_approval" }>("SELECT code FROM org_prerequisite");
    for (const g of PROGRAMME_GROUPS) {
      const eff = await getEffectiveSettings(tx, { type: "programme", id: programmeId }, g);
      problems.push(...validateGroup(g, "programme", eff.values));
      if (g === "flags") problems.push(...flagPrerequisiteProblems("programme", eff.values, new Set(prereq.rows.map((r) => r.code))));
    }
    if (problems.length) throw new SettingsRejected(problems);
    await ensureBaselines(tx, actor.organisationId, programmeId, locked.rows[0].type); // every group has a version a match can name
    await tx.query("UPDATE programme SET status = 'active', activated_at = now() WHERE id = $1", [programmeId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "programme.activate", objectType: "programme", objectId: programmeId });
  });
}

export async function closeProgramme(actor: Actor, programmeId: string): Promise<void> {
  authorize(actor, "programme.close", { programmeId });
  await withOrg(actor.organisationId, async (tx) => {
    const p = await tx.query<{ status: string }>("SELECT status FROM programme WHERE id = $1 FOR UPDATE", [programmeId]);
    if (!p.rows[0]) throw new NotFoundError();
    if (p.rows[0].status !== "active") reject("programme", "illegal_transition");
    await tx.query("UPDATE cohort SET status = 'closed' WHERE programme_id = $1 AND status <> 'closed'", [programmeId]);
    await tx.query("UPDATE programme SET status = 'closed', closed_at = now() WHERE id = $1", [programmeId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "programme.close", objectType: "programme", objectId: programmeId });
  });
}

// ---------------------------------------------------------------- cohorts
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export async function createCohort(actor: Actor, programmeId: string, input: { name: string; startDate?: string | null; endDate?: string | null }): Promise<string> {
  authorize(actor, "programme.config.edit", { programmeId });
  const name = cleanName(input.name, "name", 200);
  const start = input.startDate || null, end = input.endDate || null;
  if (start && !DATE.test(start)) reject("startDate", "date");
  if (end && !DATE.test(end)) reject("endDate", "date");
  if (start && end && start > end) reject("endDate", "before_start");
  return withOrg(actor.organisationId, async (tx) => {
    const p = await programmeRow(tx, programmeId);
    if (p.status === "closed") reject("programme", "closed");
    const r = await tx.query<{ id: string }>(
      "INSERT INTO cohort (organisation_id, programme_id, name, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [actor.organisationId, programmeId, name, start, end],
    );
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "cohort.create", objectType: "cohort", objectId: r.rows[0]!.id });
    return r.rows[0]!.id;
  });
}

export async function setCohortStatus(actor: Actor, cohortId: string, to: "open" | "running" | "closed"): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    const c = await tx.query<{ programme_id: string; status: string }>("SELECT programme_id, status FROM cohort WHERE id = $1 FOR UPDATE", [cohortId]);
    if (!c.rows[0]) throw new NotFoundError();
    authorize(actor, "programme.config.edit", { programmeId: c.rows[0].programme_id });
    const order = ["draft", "open", "running", "closed"];
    if (order.indexOf(to) <= order.indexOf(c.rows[0].status)) reject("status", "illegal_transition");
    if ((await programmeRow(tx, c.rows[0].programme_id)).status === "draft" && to !== "open") reject("status", "programme_not_active");
    await tx.query("UPDATE cohort SET status = $2 WHERE id = $1", [cohortId, to]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "cohort.status", objectType: "cohort", objectId: cohortId });
  });
}

// ---------------------------------------------------------------- sponsors (FR-PRG-006)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function addSponsor(actor: Actor, programmeId: string, input: { name: string; email: string; roleLabel: string }): Promise<string> {
  authorize(actor, "programme.config.edit", { programmeId });
  const name = cleanName(input.name, "name", 200);
  const roleLabel = cleanName(input.roleLabel, "roleLabel", 120);
  const email = input.email.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) reject("email", "email");
  return withOrg(actor.organisationId, async (tx) => {
    if ((await programmeRow(tx, programmeId)).status === "closed") reject("programme", "closed");
    const r = await tx.query<{ id: string }>(
      "INSERT INTO sponsor (organisation_id, programme_id, name, email, role_label) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (programme_id, email) DO NOTHING RETURNING id",
      [actor.organisationId, programmeId, name, email, roleLabel],
    );
    if (!r.rows[0]) return reject("email", "duplicate");
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "sponsor.add", objectType: "sponsor", objectId: r.rows[0].id });
    return r.rows[0].id;
  });
}

export async function removeSponsor(actor: Actor, sponsorId: string): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    const s = await tx.query<{ programme_id: string }>("SELECT programme_id FROM sponsor WHERE id = $1", [sponsorId]);
    if (!s.rows[0]) throw new NotFoundError();
    authorize(actor, "programme.config.edit", { programmeId: s.rows[0].programme_id });
    await tx.query("DELETE FROM sponsor WHERE id = $1", [sponsorId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "sponsor.remove", objectType: "sponsor", objectId: sponsorId });
  });
}

// ---------------------------------------------------------------- eligibility rules (FR-PRG-004)
/** Replaces the programme's rule set (all rules must hold). */
export async function saveEligibilityRules(actor: Actor, programmeId: string, rawRules: unknown): Promise<EligibilityRule[]> {
  authorize(actor, "programme.config.edit", { programmeId });
  const v = validateRules(rawRules);
  if (!v.ok) throw new ProgrammeInputError(v.problems.map((p) => ({ field: `rule${p.index}`, code: p.code })));
  return withOrg(actor.organisationId, async (tx) => {
    if ((await programmeRow(tx, programmeId)).status === "closed") reject("programme", "closed");
    await tx.query("DELETE FROM eligibility_rule WHERE programme_id = $1", [programmeId]);
    let pos = 0;
    for (const r of v.rules) {
      const { type, ...params } = r;
      await tx.query("INSERT INTO eligibility_rule (organisation_id, programme_id, rule_type, params, position) VALUES ($1, $2, $3, $4, $5)", [actor.organisationId, programmeId, type, JSON.stringify(params), pos++]);
    }
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "eligibility.save", objectType: "programme", objectId: programmeId });
    return v.rules;
  });
}

// ---------------------------------------------------------------- compatibility questionnaire definition (FR-PRG-008)
export interface QuestionInput { section: "character" | "field" | "experience"; mode: "similar" | "complementary"; scalePoints: number; text: { en: string; az: string; ru: string } }

export async function addCompatibilityQuestion(actor: Actor, programmeId: string, q: QuestionInput): Promise<string> {
  authorize(actor, "programme.config.edit", { programmeId });
  if (!["character", "field", "experience"].includes(q.section)) reject("section", "option");
  if (!["similar", "complementary"].includes(q.mode)) reject("mode", "option");
  if (!Number.isInteger(q.scalePoints) || q.scalePoints < 3 || q.scalePoints > 10) reject("scalePoints", "range", { min: 3, max: 10 });
  const text = { en: cleanName(q.text.en, "text_en", 300), az: cleanName(q.text.az, "text_az", 300), ru: cleanName(q.text.ru, "text_ru", 300) };
  return withOrg(actor.organisationId, async (tx) => {
    const p = await programmeRow(tx, programmeId);
    if (p.status === "closed") reject("programme", "closed");
    if (p.type === "sparklab") reject("programme", "no_questionnaire"); // SparkLab's "Other" weight is 0
    const pos = await tx.query<{ n: number }>("SELECT COALESCE(max(position), -1) + 1 AS n FROM compatibility_question WHERE programme_id = $1 AND section = $2", [programmeId, q.section]);
    const r = await tx.query<{ id: string }>(
      `INSERT INTO compatibility_question (organisation_id, programme_id, section, mode, scale_points, text_en, text_az, text_ru, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [actor.organisationId, programmeId, q.section, q.mode, q.scalePoints, text.en, text.az, text.ru, pos.rows[0]!.n],
    );
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "compat_question.add", objectType: "compatibility_question", objectId: r.rows[0]!.id });
    return r.rows[0]!.id;
  });
}

export async function removeCompatibilityQuestion(actor: Actor, questionId: string): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    const q = await tx.query<{ programme_id: string }>("SELECT programme_id FROM compatibility_question WHERE id = $1", [questionId]);
    if (!q.rows[0]) throw new NotFoundError();
    authorize(actor, "programme.config.edit", { programmeId: q.rows[0].programme_id });
    await tx.query("DELETE FROM compatibility_question WHERE id = $1", [questionId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "compat_question.remove", objectType: "compatibility_question", objectId: questionId });
  });
}

// ---------------------------------------------------------------- save as template (AC-PRG-06.4)
/** Stores the programme's CURRENT settings versions (by reference), rubric reference and report schedule as a reusable template. No people. */
export async function saveAsTemplate(actor: Actor, programmeId: string, rawName: string): Promise<string> {
  authorize(actor, "programme.template.save", { programmeId });
  const name = cleanName(rawName, "name", 120);
  return withOrg(actor.organisationId, async (tx) => {
    const p = await tx.query<{ type: ProgrammeType; report_schedule: ReportSchedule; rubric_version_id: string | null }>(
      "SELECT type, report_schedule, rubric_version_id FROM programme WHERE id = $1", [programmeId],
    );
    if (!p.rows[0]) throw new NotFoundError();
    const versions = await ensureBaselines(tx, actor.organisationId, programmeId, p.rows[0].type);
    const t = await tx.query<{ id: string }>(
      `INSERT INTO settings_template (organisation_id, name, programme_type, report_schedule, rubric_version_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (organisation_id, lower(name)) DO NOTHING RETURNING id`,
      [actor.organisationId, name, p.rows[0].type, p.rows[0].report_schedule, p.rows[0].rubric_version_id, actor.membershipId],
    );
    if (!t.rows[0]) return reject("name", "duplicate");
    for (const [group, versionId] of Object.entries(versions))
      await tx.query("INSERT INTO settings_template_item (template_id, organisation_id, setting_group, settings_version_id) VALUES ($1, $2, $3, $4)", [t.rows[0].id, actor.organisationId, group, versionId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "programme.template.save", objectType: "settings_template", objectId: t.rows[0].id });
    return t.rows[0].id;
  });
}
