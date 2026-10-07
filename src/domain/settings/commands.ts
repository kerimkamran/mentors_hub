/**
 * Settings writes: save, restore a version, restore defaults, import, clone (US-PRG-01/03/04/05/06, US-TEN-04/05).
 * Every write: authorize first (denial = not found), validate the WHOLE group as a set, confirm on an active programme
 * (impact summary), step-up for sign-in/session security, insert a NEW immutable version, audit by id (no values, no text).
 */
import { audit } from "../../lib/audit";
import { verifyStepUpCode } from "../../lib/auth/stepup";
import { withOrg, type Tx } from "../../lib/db";
import { authorize, NotFoundError, type Actor } from "../../lib/permissions";
import { latestVersion, programmeType, getEffectiveSettings, insertVersion } from "./access";
import { diffValues, type DiffRow } from "./diff";
import { buildExport, parseImport, type ImportProblem, type SettingsFile } from "./exchange";
import { impactLines } from "./impact";
import { checkLogo } from "./logo";
import { deepMerge, defaultValues, flagPrerequisiteProblems, groupAllowed, validateGroup, withDefaults, type Prerequisite } from "./registry";
import {
  ConfirmationRequired, PROGRAMME_GROUPS, SettingsRejected, STEP_UP_GROUPS, StepUpFailed,
  type GroupId, type ImpactLine, type Problem, type ProgrammeType, type SettingsScope, type Values,
} from "./types";
import { createHash } from "node:crypto";

export type Mode = "save" | "restore" | "defaults" | "import" | "clone";

export interface SaveOpts {
  /** The person saw the impact summary and confirmed (required for a change to an ACTIVE programme, rule 7). */
  confirmed?: boolean;
  /** Authenticator code for sign-in/session security groups (AC-TEN-04.5). */
  stepUpCode?: string;
  /** The patch carries complete values that REPLACE the group (restore, defaults, import) instead of merging into it. */
  replace?: boolean;
  mode?: Mode;
  restoredFrom?: string;
  now?: Date;
}

export interface Change { group: GroupId; before: Values; after: Values; rows: DiffRow[]; currentVersionId: string | null }
export interface Plan {
  problems: Problem[];
  changes: Change[];
  impact: ImpactLine[];
  programmeStatus?: "draft" | "active" | "closed";
  needsConfirmation: boolean;
  needsStepUp: boolean;
}
export interface SavedVersion { group: GroupId; versionId: string; versionNumber: number }

const resourceOf = (scope: SettingsScope) => (scope.type === "programme" ? { programmeId: scope.id } : {});

/** Which permission row guards a write to `group` (one authorisation system, INV-4.1). */
export function writeAction(scope: SettingsScope, group: GroupId, mode: Mode): string {
  if (scope.type === "programme") {
    if (mode === "restore" || mode === "defaults") return "programme.settings.restore";
    if (mode === "import" || mode === "clone") return "programme.settings.import";
    return group === "flags" ? "programme.flags.edit" : "programme.settings.edit";
  }
  if (mode === "restore" || mode === "defaults") return "org.settings.restore";
  if (group === "security" || group === "session_timing") return "org.security.change";
  if (group === "brand") return "org.brand.change";
  return "org.settings.change";
}

async function recordedPrerequisites(tx: Tx): Promise<Set<Prerequisite>> {
  const r = await tx.query<{ code: Prerequisite }>("SELECT code FROM org_prerequisite");
  return new Set(r.rows.map((x) => x.code));
}

/** Read-only planning step shared by preview, save, restore and import. */
async function planIn(tx: Tx, actor: Actor, scope: SettingsScope, patch: Partial<Record<GroupId, Values>>, opts: SaveOpts): Promise<Plan> {
  const mode = opts.mode ?? "save";
  const groups = Object.keys(patch) as GroupId[];
  for (const g of groups) {
    if (!groupAllowed(g, scope.type)) throw new NotFoundError();
    authorize(actor, writeAction(scope, g, mode), resourceOf(scope));
  }
  let type: ProgrammeType = "leadership";
  let status: Plan["programmeStatus"];
  if (scope.type === "programme") {
    const p = await tx.query<{ type: ProgrammeType; status: "draft" | "active" | "closed" }>("SELECT type, status FROM programme WHERE id = $1", [scope.id]);
    if (!p.rows[0]) throw new NotFoundError();
    type = p.rows[0].type;
    status = p.rows[0].status;
  }
  const problems: Problem[] = [];
  const changes: Change[] = [];
  if (status === "closed") problems.push({ group: groups[0] ?? "flags", path: "", code: "programme_closed" });
  const recorded = groups.includes("flags") ? await recordedPrerequisites(tx) : new Set<Prerequisite>();
  for (const group of groups) {
    const row = await latestVersion(tx, scope, group);
    let before = withDefaults(group, scope.type, row?.values, type);
    if (scope.type === "organisation" && group === "flags") {
      const sw = await tx.query<{ ai_enabled: boolean }>("SELECT ai_enabled FROM organisation WHERE id = app_org_id()");
      before = { ...before, aiEnabled: sw.rows[0]?.ai_enabled === true }; // the column is the live kill switch
    }
    if (scope.type === "organisation" && group === "localisation") {
      const o = await tx.query<{ default_locale: string; time_zone: string }>("SELECT default_locale, time_zone FROM organisation WHERE id = app_org_id()");
      if (o.rows[0]) before = { defaultLocale: o.rows[0].default_locale, timeZone: o.rows[0].time_zone };
    }
    const incoming = patch[group]!;
    const after = opts.replace ? withDefaults(group, scope.type, incoming, type) : deepMerge(before, incoming);
    const found = validateGroup(group, scope.type, after);
    if (group === "flags") found.push(...flagPrerequisiteProblems(scope.type, after, recorded));
    if (group === "brand" && typeof after.logoId === "string") {
      const logo = await tx.query("SELECT 1 FROM org_logo WHERE id = $1", [after.logoId]);
      if (!logo.rowCount) found.push({ group, path: "logoId", code: "identifier" });
    }
    problems.push(...found);
    const rows = diffValues(before, after);
    if (!found.length && rows.length) changes.push({ group, before, after, rows, currentVersionId: row?.id ?? null });
  }
  const impact = problems.length || !changes.length ? [] : await impactLines(tx, scope, changes, status);
  return {
    problems,
    changes,
    impact,
    programmeStatus: status,
    needsConfirmation: status === "active" && changes.length > 0,
    needsStepUp: changes.some((c) => STEP_UP_GROUPS.includes(c.group)),
  };
}

/** What a save WOULD do: validation problems, the changed values and the plain-language impact. Writes nothing (used by the review step). */
export async function previewSettings(actor: Actor, scope: SettingsScope, patch: Partial<Record<GroupId, Values>>, opts: SaveOpts = {}): Promise<Plan> {
  for (const g of Object.keys(patch) as GroupId[]) {
    if (!groupAllowed(g, scope.type)) throw new NotFoundError();
    authorize(actor, writeAction(scope, g, opts.mode ?? "save"), resourceOf(scope));
  }
  return withOrg(actor.organisationId, (tx) => planIn(tx, actor, scope, patch, opts));
}

export async function saveSettings(actor: Actor, scope: SettingsScope, patch: Partial<Record<GroupId, Values>>, opts: SaveOpts = {}): Promise<SavedVersion[]> {
  const mode = opts.mode ?? "save";
  for (const g of Object.keys(patch) as GroupId[]) {
    if (!groupAllowed(g, scope.type)) throw new NotFoundError();
    authorize(actor, writeAction(scope, g, mode), resourceOf(scope));
  }
  const dry = await withOrg(actor.organisationId, (tx) => planIn(tx, actor, scope, patch, opts));
  if (dry.problems.length) throw new SettingsRejected(dry.problems);
  if (!dry.changes.length) return [];
  if (dry.needsConfirmation && !opts.confirmed) throw new ConfirmationRequired(dry.impact);
  if (dry.needsStepUp && !(opts.stepUpCode && (await verifyStepUpCode(actor, opts.stepUpCode, (opts.now ?? new Date()).getTime())))) throw new StepUpFailed();

  return withOrg(actor.organisationId, async (tx) => {
    const plan = await planIn(tx, actor, scope, patch, opts); // re-validated inside the write transaction
    if (plan.problems.length) throw new SettingsRejected(plan.problems);
    const saved: SavedVersion[] = [];
    for (const c of plan.changes) {
      const v = await insertVersion(tx, { organisationId: actor.organisationId, scope, group: c.group, values: c.after, createdBy: actor.membershipId, restoredFrom: opts.restoredFrom ?? null });
      await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: `settings.${c.group}.${mode}`, objectType: "settings_version", objectId: v.id });
      if (scope.type === "organisation" && c.group === "flags") await tx.query("SELECT mh_set_org_ai_enabled($1)", [c.after.aiEnabled === true]);
      if (scope.type === "organisation" && c.group === "localisation") await tx.query("SELECT mh_set_org_localisation($1, $2)", [c.after.defaultLocale, c.after.timeZone]);
      saved.push({ group: c.group, versionId: v.id, versionNumber: v.versionNumber });
    }
    return saved;
  });
}

/** The scope and group of a version, or not-found (an id outside the actor's organisation is invisible by RLS). */
export async function locateVersion(actor: Actor, versionId: string): Promise<{ scope: SettingsScope; group: GroupId; values: Values; versionNumber: number }> {
  const r = await withOrg(actor.organisationId, (tx) =>
    tx.query<{ scope: "organisation" | "programme"; scope_id: string | null; setting_group: GroupId; values: Values; version_number: number }>(
      "SELECT scope, scope_id, setting_group, values, version_number FROM settings_version WHERE id = $1",
      [versionId],
    ),
  );
  const v = r.rows[0];
  if (!v) throw new NotFoundError();
  const scope: SettingsScope = v.scope === "programme" ? { type: "programme", id: v.scope_id! } : { type: "organisation" };
  return { scope, group: v.setting_group, values: v.values, versionNumber: v.version_number };
}

/** Restore an earlier version as a NEW version (the old one is untouched), through the same validation and impact summary (AC-PRG-04.3). */
export async function restoreVersion(actor: Actor, versionId: string, opts: SaveOpts = {}): Promise<SavedVersion[]> {
  const v = await locateVersion(actor, versionId);
  authorize(actor, writeAction(v.scope, v.group, "restore"), resourceOf(v.scope));
  return saveSettings(actor, v.scope, { [v.group]: v.values }, { ...opts, replace: true, mode: "restore", restoredFrom: versionId });
}

export const previewRestore = async (actor: Actor, versionId: string, opts: SaveOpts = {}): Promise<Plan & { scope: SettingsScope; group: GroupId }> => {
  const v = await locateVersion(actor, versionId);
  authorize(actor, writeAction(v.scope, v.group, "restore"), resourceOf(v.scope));
  const plan = await previewSettings(actor, v.scope, { [v.group]: v.values }, { ...opts, replace: true, mode: "restore", restoredFrom: versionId });
  return { ...plan, scope: v.scope, group: v.group };
};

async function defaultsFor(actor: Actor, scope: SettingsScope, group: GroupId): Promise<Values> {
  const type = scope.type === "programme" ? await withOrg(actor.organisationId, (tx) => programmeType(tx, scope.id)) : "leadership";
  return defaultValues(group, scope.type, type);
}

/** Return a group to the starting values (AC-PRG-04.4). The values that differ are in `previewDefaults(...).changes`. */
export async function restoreDefaults(actor: Actor, scope: SettingsScope, group: GroupId, opts: SaveOpts = {}): Promise<SavedVersion[]> {
  authorize(actor, writeAction(scope, group, "defaults"), resourceOf(scope));
  const defaults = await defaultsFor(actor, scope, group);
  return saveSettings(actor, scope, { [group]: defaults }, { ...opts, replace: true, mode: "defaults" });
}
export async function previewDefaults(actor: Actor, scope: SettingsScope, group: GroupId, opts: SaveOpts = {}): Promise<Plan> {
  authorize(actor, writeAction(scope, group, "defaults"), resourceOf(scope));
  const defaults = await defaultsFor(actor, scope, group);
  return previewSettings(actor, scope, { [group]: defaults }, { ...opts, replace: true, mode: "defaults" });
}

// ---------------------------------------------------------------- export / import / clone (FR-ADM-006)
export async function exportProgrammeSettings(actor: Actor, programmeId: string): Promise<SettingsFile> {
  authorize(actor, "programme.settings.export", { programmeId });
  return withOrg(actor.organisationId, async (tx) => {
    const p = await tx.query<{ type: ProgrammeType; report_schedule: SettingsFile["reportSchedule"] }>("SELECT type, report_schedule FROM programme WHERE id = $1", [programmeId]);
    if (!p.rows[0]) throw new NotFoundError();
    const groups: SettingsFile["groups"] = {};
    for (const g of PROGRAMME_GROUPS) groups[g] = (await getEffectiveSettings(tx, { type: "programme", id: programmeId }, g)).values as unknown as Values;
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "settings.export", objectType: "programme", objectId: programmeId });
    return buildExport(p.rows[0].type, p.rows[0].report_schedule, groups);
  });
}

/** Validates a file as a whole and diffs it against the programme's current settings. Nothing is saved. */
export async function previewImport(actor: Actor, programmeId: string, text: string): Promise<{ problems: ImportProblem[]; plan?: Plan }> {
  authorize(actor, "programme.settings.import", { programmeId });
  const parsed = parseImport(text);
  if (!parsed.ok) return { problems: parsed.problems };
  const plan = await previewSettings(actor, { type: "programme", id: programmeId }, parsed.file.groups as Partial<Record<GroupId, Values>>, { replace: true, mode: "import" });
  return { problems: plan.problems, plan };
}

export async function importSettings(actor: Actor, programmeId: string, text: string, opts: SaveOpts = {}): Promise<SavedVersion[]> {
  authorize(actor, "programme.settings.import", { programmeId });
  const parsed = parseImport(text);
  if (!parsed.ok) throw new SettingsRejected(parsed.problems as Problem[]);
  return saveSettings(actor, { type: "programme", id: programmeId }, parsed.file.groups as Partial<Record<GroupId, Values>>, { ...opts, replace: true, mode: "import" });
}

/** Copy one programme's settings into another (both must be in the actor's scope). */
export async function cloneSettings(actor: Actor, fromProgrammeId: string, toProgrammeId: string, opts: SaveOpts = {}): Promise<SavedVersion[]> {
  const file = await exportProgrammeSettings(actor, fromProgrammeId); // authorizes the source
  authorize(actor, "programme.settings.import", { programmeId: toProgrammeId });
  return saveSettings(actor, { type: "programme", id: toProgrammeId }, file.groups as Partial<Record<GroupId, Values>>, { ...opts, replace: true, mode: "clone" });
}

// ---------------------------------------------------------------- organisation: recorded approvals and logo
/** Records a flag prerequisite (DPIA sign-off, storage approval). Needs an authenticator code; recorded once, never edited. */
export async function recordPrerequisite(actor: Actor, code: Prerequisite, stepUpCode: string, now = new Date()): Promise<void> {
  authorize(actor, "org.prerequisite.record");
  if (!(await verifyStepUpCode(actor, stepUpCode, now.getTime()))) throw new StepUpFailed();
  await withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ id: string }>(
      "INSERT INTO org_prerequisite (organisation_id, code, recorded_by) VALUES ($1, $2, $3) ON CONFLICT (organisation_id, code) DO NOTHING RETURNING id",
      [actor.organisationId, code, actor.membershipId],
    );
    if (r.rows[0]) await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: `org.prerequisite.${code}`, objectType: "org_prerequisite", objectId: r.rows[0].id });
  });
}

/** Stores a validated logo image and returns its id. The brand version that uses it is saved separately (AC-TEN-05.3). */
export async function uploadLogo(actor: Actor, bytes: Uint8Array): Promise<string> {
  authorize(actor, "org.brand.change");
  const check = checkLogo(bytes);
  if (!check.ok) throw new SettingsRejected([{ group: "brand", path: "logoId", code: `logo_${check.code}` }]);
  return withOrg(actor.organisationId, async (tx) => {
    const buf = Buffer.from(bytes);
    const r = await tx.query<{ id: string }>(
      "INSERT INTO org_logo (organisation_id, content_type, byte_size, sha256, data, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [actor.organisationId, check.contentType, buf.length, createHash("sha256").update(buf).digest("hex"), buf, actor.membershipId],
    );
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "org.logo.upload", objectType: "org_logo", objectId: r.rows[0]!.id });
    return r.rows[0]!.id;
  });
}
