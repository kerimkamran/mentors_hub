/**
 * Read accessors for the settings registry. Everything that needs an admin-managed number goes through here
 * (ARCHITECTURE rule 9): `getEffectiveSettings` (defaults fallback), `getMatchingSettings`, `getEffectiveFlags`.
 * `ctx` is either a transaction already inside `withOrg` or an organisation id taken from the signed-in session.
 */
import { withOrg, type Tx } from "../../lib/db";
import { NotFoundError } from "../../lib/permissions";
import type { ProgrammeType } from "../../lib/constants-programmes";
import { defaultValues, withDefaults } from "./registry";
import type { GroupId, GroupValues, MatchingValues, OrgFlagsValues, ProgrammeFlagsValues, ScopeKind, SettingsScope, Values } from "./types";

export type Ctx = Tx | string;
export const inCtx = <T>(ctx: Ctx, fn: (tx: Tx) => Promise<T>): Promise<T> => (typeof ctx === "string" ? withOrg(ctx, fn) : fn(ctx));

export interface EffectiveSettings<V> {
  /** The settings_version row in force, or null when the starting defaults apply (nothing saved yet). */
  versionId: string | null;
  versionNumber: number;
  values: V;
  isDefault: boolean;
}

export const lockKey = (orgId: string, scope: SettingsScope, group: GroupId) => `${orgId}|${scope.type}|${scope.type === "programme" ? scope.id : ""}|${group}`;

export async function programmeType(tx: Tx, programmeId: string): Promise<ProgrammeType> {
  const r = await tx.query<{ type: ProgrammeType }>("SELECT type FROM programme WHERE id = $1", [programmeId]);
  if (!r.rows[0]) throw new NotFoundError();
  return r.rows[0].type;
}

interface VersionRow { id: string; version_number: number; values: Values }

export async function latestVersion(tx: Tx, scope: SettingsScope, group: GroupId): Promise<VersionRow | undefined> {
  const r = await tx.query<VersionRow>(
    `SELECT id, version_number, values FROM settings_version
     WHERE scope = $1 AND scope_id IS NOT DISTINCT FROM $2 AND setting_group = $3
     ORDER BY version_number DESC LIMIT 1`,
    [scope.type, scope.type === "programme" ? scope.id : null, group],
  );
  return r.rows[0];
}

export async function getEffectiveSettings<G extends GroupId>(ctx: Ctx, scope: SettingsScope, group: G): Promise<EffectiveSettings<GroupValues[G]>> {
  return inCtx(ctx, async (tx) => {
    const type = scope.type === "programme" ? await programmeType(tx, scope.id) : "leadership";
    const row = await latestVersion(tx, scope, group);
    const kind: ScopeKind = scope.type;
    if (!row) return { versionId: null, versionNumber: 0, values: defaultValues(group, kind, type) as unknown as GroupValues[G], isDefault: true };
    return { versionId: row.id, versionNumber: row.version_number, values: withDefaults(group, kind, row.values, type) as unknown as GroupValues[G], isDefault: false };
  });
}

/** Inserts the next immutable version (advisory-locked numbering). Callers validate first; the database guard is a second wall. */
export async function insertVersion(
  tx: Tx,
  o: { organisationId: string; scope: SettingsScope; group: GroupId; values: Values; createdBy: string | null; restoredFrom?: string | null },
): Promise<{ id: string; versionNumber: number }> {
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lockKey(o.organisationId, o.scope, o.group)]);
  const scopeId = o.scope.type === "programme" ? o.scope.id : null;
  const r = await tx.query<{ id: string; version_number: number }>(
    `INSERT INTO settings_version (organisation_id, scope, scope_id, setting_group, version_number, values, created_by, restored_from_version_id)
     VALUES ($1, $2, $3, $4,
       (SELECT COALESCE(max(version_number), 0) + 1 FROM settings_version WHERE scope = $2 AND scope_id IS NOT DISTINCT FROM $3 AND setting_group = $4),
       $5, $6, $7)
     RETURNING id, version_number`,
    [o.organisationId, o.scope.type, scopeId, o.group, JSON.stringify(o.values), o.createdBy, o.restoredFrom ?? null],
  );
  return { id: r.rows[0]!.id, versionNumber: r.rows[0]!.version_number };
}

/**
 * The programme's matching settings: ONE version id plus every engine parameter (factors, sub-scores, thresholds, weights,
 * exclusion switches, horizon). The engine never reads storage; callers pass `values` in and store `versionId` with each match
 * (INV-7.4). A programme created outside the settings centre gets its baseline version here, once, so a match can always name it.
 */
export async function getMatchingSettings(ctx: Ctx, programmeId: string): Promise<{ versionId: string; versionNumber: number; values: MatchingValues }> {
  return inCtx(ctx, async (tx) => {
    const scope: SettingsScope = { type: "programme", id: programmeId };
    const type = await programmeType(tx, programmeId);
    let row = await latestVersion(tx, scope, "matching");
    if (!row) {
      const org = await tx.query<{ organisation_id: string }>("SELECT organisation_id FROM programme WHERE id = $1", [programmeId]);
      const made = await insertVersionIfAbsent(tx, org.rows[0]!.organisation_id, scope, "matching", defaultValues("matching", "programme", type));
      row = { id: made.id, version_number: made.versionNumber, values: defaultValues("matching", "programme", type) };
    }
    return { versionId: row.id, versionNumber: row.version_number, values: withDefaults("matching", "programme", row.values, type) as unknown as MatchingValues };
  });
}

async function insertVersionIfAbsent(tx: Tx, organisationId: string, scope: SettingsScope, group: GroupId, values: Values) {
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lockKey(organisationId, scope, group)]);
  const again = await latestVersion(tx, scope, group);
  if (again) return { id: again.id, versionNumber: again.version_number };
  return insertVersion(tx, { organisationId, scope, group, values, createdBy: null });
}

/** Makes sure every programme group has a version (the system-seeded baseline) and returns the latest version id per group. */
export async function ensureBaselines(tx: Tx, organisationId: string, programmeId: string, type: ProgrammeType): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const group of ["cadence_capacity", "matching", "timings", "flags"] as const) {
    const scope: SettingsScope = { type: "programme", id: programmeId };
    const existing = await latestVersion(tx, scope, group);
    out[group] = existing ? existing.id : (await insertVersionIfAbsent(tx, organisationId, scope, group, defaultValues(group, "programme", type))).id;
  }
  return out;
}

export async function getCadenceDays(ctx: Ctx, programmeId: string): Promise<number> {
  return (await getEffectiveSettings(ctx, { type: "programme", id: programmeId }, "cadence_capacity")).values.cadenceDays;
}

export interface EffectiveFlags {
  /** organisation.ai_enabled: the organisation AI kill switch (INV-6). Off by default. */
  aiKillSwitchOn: boolean;
  org: OrgFlagsValues;
  programme?: ProgrammeFlagsValues;
  /** What may actually run. A programme AI flag never overrides the organisation switch (AC-PRG-05.3). Consent is checked elsewhere (FR-AIA-002). */
  effective: { aiAllowed: boolean; smartGoalAssistant: boolean; agendaAssistant: boolean; aiTranslation: boolean; attachments: boolean; openMentoring: boolean; openReports: boolean };
}

export async function getEffectiveFlags(ctx: Ctx, programmeId?: string): Promise<EffectiveFlags> {
  return inCtx(ctx, async (tx) => {
    const org = (await getEffectiveSettings(tx, { type: "organisation" }, "flags")).values as OrgFlagsValues;
    const sw = await tx.query<{ ai_enabled: boolean }>("SELECT ai_enabled FROM organisation WHERE id = app_org_id()");
    const kill = sw.rows[0]?.ai_enabled === true; // fail closed: unreadable => off
    let programme: ProgrammeFlagsValues | undefined;
    let type: ProgrammeType | undefined;
    if (programmeId) {
      type = await programmeType(tx, programmeId);
      programme = (await getEffectiveSettings(tx, { type: "programme", id: programmeId }, "flags")).values as ProgrammeFlagsValues;
    }
    const aiAllowed = kill && (programme ? programme.aiEnabled === true : true);
    return {
      aiKillSwitchOn: kill,
      org: { ...org, aiEnabled: kill },
      programme,
      effective: {
        aiAllowed,
        smartGoalAssistant: aiAllowed && org.smartGoalAssistant,
        agendaAssistant: aiAllowed && org.agendaAssistant,
        aiTranslation: kill && org.aiTranslation,
        attachments: org.attachments && (programme ? programme.attachments : true),
        openMentoring: org.openMentoring,
        openReports: !!programme && programme.openReports && type === "open",
      },
    };
  });
}
