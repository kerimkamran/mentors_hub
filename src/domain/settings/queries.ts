/** Settings reads for the screens: current values, history, compare, flag states. Authorized per scope; denial = not found. */
import { withOrg } from "../../lib/db";
import { authorize, NotFoundError, type Actor } from "../../lib/permissions";
import { getEffectiveSettings, programmeType } from "./access";
import { diffValues, type DiffRow } from "./diff";
import { FLAG_KEYS, getPath } from "./registry";
import { groupsOf, type GroupId, type SettingsScope, type Values } from "./types";

const resourceOf = (scope: SettingsScope) => (scope.type === "programme" ? { programmeId: scope.id } : {});
const readAction = (s: SettingsScope) => (s.type === "programme" ? "programme.settings.read" : "org.settings.read");
const historyAction = (s: SettingsScope) => (s.type === "programme" ? "programme.settings.history" : "org.settings.history");

export interface CurrentGroup {
  group: GroupId;
  versionId: string | null;
  versionNumber: number;
  values: Values;
  isDefault: boolean;
  changedBy: string | null; // display name; null for defaults and the system baseline
  changedAt: Date | null;
}

/** Current values of every group at this scope, with who last changed each (A7). */
export async function readSettings(actor: Actor, scope: SettingsScope): Promise<{ type?: string; status?: string; groups: Record<string, CurrentGroup> }> {
  authorize(actor, readAction(scope), resourceOf(scope));
  return withOrg(actor.organisationId, async (tx) => {
    let type: string | undefined, status: string | undefined;
    if (scope.type === "programme") {
      const p = await tx.query<{ type: string; status: string }>("SELECT type, status FROM programme WHERE id = $1", [scope.id]);
      if (!p.rows[0]) throw new NotFoundError();
      ({ type, status } = p.rows[0]);
    }
    const groups: Record<string, CurrentGroup> = {};
    for (const g of groupsOf(scope.type)) {
      const eff = await getEffectiveSettings(tx, scope, g);
      let by: string | null = null, at: Date | null = null;
      if (eff.versionId) {
        const m = await tx.query<{ display_name: string | null; created_at: Date }>(
          `SELECT p.display_name, v.created_at FROM settings_version v LEFT JOIN person_profile p ON p.membership_id = v.created_by WHERE v.id = $1`,
          [eff.versionId],
        );
        by = m.rows[0]?.display_name ?? null;
        at = m.rows[0]?.created_at ?? null;
      }
      groups[g] = { group: g, versionId: eff.versionId, versionNumber: eff.versionNumber, values: eff.values as unknown as Values, isDefault: eff.isDefault, changedBy: by, changedAt: at };
    }
    return { type, status, groups };
  });
}

export interface VersionSummary {
  id: string;
  group: GroupId;
  versionNumber: number;
  createdAt: Date;
  createdByName: string | null;
  restoredFromNumber: number | null;
}

/** Every version at this scope, newest first: number, group, who, when (AC-PRG-04.1). */
export async function listVersions(actor: Actor, scope: SettingsScope): Promise<VersionSummary[]> {
  authorize(actor, historyAction(scope), resourceOf(scope));
  return withOrg(actor.organisationId, async (tx) => {
    if (scope.type === "programme") await programmeType(tx, scope.id); // not found for a missing programme
    const r = await tx.query<{ id: string; setting_group: GroupId; version_number: number; created_at: Date; display_name: string | null; restored_number: number | null }>(
      `SELECT v.id, v.setting_group, v.version_number, v.created_at, p.display_name, o.version_number AS restored_number
       FROM settings_version v
       LEFT JOIN person_profile p ON p.membership_id = v.created_by
       LEFT JOIN settings_version o ON o.id = v.restored_from_version_id
       WHERE v.scope = $1 AND v.scope_id IS NOT DISTINCT FROM $2
       ORDER BY v.created_at DESC, v.version_number DESC`,
      [scope.type, scope.type === "programme" ? scope.id : null],
    );
    return r.rows.map((x) => ({ id: x.id, group: x.setting_group, versionNumber: x.version_number, createdAt: x.created_at, createdByName: x.display_name, restoredFromNumber: x.restored_number }));
  });
}

export interface Comparison {
  group: GroupId;
  a: { id: string; versionNumber: number; createdAt: Date; createdByName: string | null };
  b: { id: string; versionNumber: number; createdAt: Date; createdByName: string | null };
  rows: DiffRow[];
}

/** Side-by-side diff of two versions of the same group at the same scope; unchanged values omitted (AC-PRG-04.2). */
export async function compareVersions(actor: Actor, aId: string, bId: string): Promise<Comparison> {
  const r = await withOrg(actor.organisationId, (tx) =>
    tx.query<{ id: string; scope: "organisation" | "programme"; scope_id: string | null; setting_group: GroupId; version_number: number; values: Values; created_at: Date; display_name: string | null }>(
      `SELECT v.id, v.scope, v.scope_id, v.setting_group, v.version_number, v.values, v.created_at, p.display_name
       FROM settings_version v LEFT JOIN person_profile p ON p.membership_id = v.created_by WHERE v.id = ANY($1::uuid[])`,
      [[aId, bId]],
    ),
  );
  const a = r.rows.find((x) => x.id === aId), b = r.rows.find((x) => x.id === bId);
  if (!a || !b) throw new NotFoundError();
  const scope: SettingsScope = a.scope === "programme" ? { type: "programme", id: a.scope_id! } : { type: "organisation" };
  authorize(actor, historyAction(scope), resourceOf(scope));
  if (a.scope !== b.scope || a.scope_id !== b.scope_id || a.setting_group !== b.setting_group) throw new NotFoundError(); // only like with like
  const meta = (x: typeof a) => ({ id: x.id, versionNumber: x.version_number, createdAt: x.created_at, createdByName: x.display_name });
  return { group: a.setting_group, a: meta(a), b: meta(b), rows: diffValues(a.values, b.values) };
}

export interface FlagState {
  key: string;
  scope: "organisation" | "programme";
  value: boolean;
  changedBy: string | null;
  changedAt: Date | null;
}

/** Each flag's current value and who last changed it, from the flags versions at one scope (AC-PRG-05.1). */
export async function flagStates(actor: Actor, scope: SettingsScope): Promise<FlagState[]> {
  authorize(actor, readAction(scope), resourceOf(scope));
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ values: Values; created_at: Date; display_name: string | null }>(
      `SELECT v.values, v.created_at, p.display_name FROM settings_version v LEFT JOIN person_profile p ON p.membership_id = v.created_by
       WHERE v.scope = $1 AND v.scope_id IS NOT DISTINCT FROM $2 AND v.setting_group = 'flags' ORDER BY v.version_number ASC`,
      [scope.type, scope.type === "programme" ? scope.id : null],
    );
    const last = new Map<string, { value: boolean; by: string | null; at: Date | null }>();
    for (const k of FLAG_KEYS[scope.type]) last.set(k, { value: false, by: null, at: null });
    for (const row of r.rows)
      for (const k of FLAG_KEYS[scope.type]) {
        const v = getPath(row.values, k) === true;
        if (last.get(k)!.value !== v) last.set(k, { value: v, by: row.display_name, at: row.created_at });
      }
    if (scope.type === "organisation") {
      const sw = await tx.query<{ ai_enabled: boolean }>("SELECT ai_enabled FROM organisation WHERE id = app_org_id()");
      const cur = last.get("aiEnabled")!;
      last.set("aiEnabled", { ...cur, value: sw.rows[0]?.ai_enabled === true });
    }
    return FLAG_KEYS[scope.type].map((k) => ({ key: k, scope: scope.type, value: last.get(k)!.value, changedBy: last.get(k)!.by, changedAt: last.get(k)!.at }));
  });
}

export async function recordedApprovals(actor: Actor): Promise<{ code: string; recordedAt: Date }[]> {
  authorize(actor, "org.settings.read");
  const r = await withOrg(actor.organisationId, (tx) => tx.query<{ code: string; recorded_at: Date }>("SELECT code, recorded_at FROM org_prerequisite ORDER BY code"));
  return r.rows.map((x) => ({ code: x.code, recordedAt: x.recorded_at }));
}
