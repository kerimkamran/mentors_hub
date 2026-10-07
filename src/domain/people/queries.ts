/** Read side of the people import (SCR-25 imports, US-ADM-07). No writes here (pages call only this module). */
import { withOrg, type Tx } from "@/lib/db";
import { authorize, can, NotFoundError, type Actor } from "@/lib/permissions";
import { importSettings } from "./settings";
import type { Outcome } from "./types";

export interface RunCounts {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  rejected: number;
  keptAdmins: number;
  ladderAdded: number;
  ladderChanged: number;
  flaggedRelationships: number;
}

export interface RunSummary {
  id: string;
  mode: "dry_run" | "confirmed";
  state: "previewed" | "applied";
  format: "csv" | "xlsx";
  fullSync: boolean;
  isSynthetic: boolean;
  createdAt: Date;
  confirmedAt: Date | null;
  startedByName: string | null;
  scopeProgrammeId: string | null;
  scopeCohortId: string | null;
  scopeName: string | null;
  rowsPurged: boolean;
  ignoredColumns: number;
  presentColumns: string[];
  counts: RunCounts;
}

export interface RunRow {
  rowNumber: number | null;
  outcome: Outcome;
  reasonCode: string | null;
  raw: Record<string, string>;
}

interface RunDb {
  id: string; mode: RunSummary["mode"]; state: RunSummary["state"]; source_format: "csv" | "xlsx"; full_sync: boolean; is_synthetic: boolean;
  created_at: Date; confirmed_at: Date | null; started_by_name: string | null; programme_id: string | null; cohort_id: string | null;
  programme_name: string | null; cohort_name: string | null; rows_purged_at: Date | null; ignored_columns: number; present_columns: string[];
  total_rows: number; created_count: number; updated_count: number; unchanged_count: number; deactivated_count: number; rejected_count: number;
  kept_admin_count: number; ladder_added: number; ladder_changed: number; flagged_relationships: number;
}

const RUN_SELECT = `
  SELECT r.*, sp.display_name AS started_by_name, pr.name AS programme_name, co.name AS cohort_name
  FROM import_run r
  LEFT JOIN person_profile sp ON sp.membership_id = r.started_by
  LEFT JOIN programme pr ON pr.id = r.programme_id
  LEFT JOIN cohort co ON co.id = r.cohort_id`;

export function toSummary(x: RunDb): RunSummary {
  return {
    id: x.id, mode: x.mode, state: x.state, format: x.source_format, fullSync: x.full_sync, isSynthetic: x.is_synthetic,
    createdAt: x.created_at, confirmedAt: x.confirmed_at, startedByName: x.started_by_name,
    scopeProgrammeId: x.programme_id, scopeCohortId: x.cohort_id, scopeName: x.cohort_name ?? x.programme_name,
    rowsPurged: x.rows_purged_at !== null, ignoredColumns: x.ignored_columns, presentColumns: x.present_columns,
    counts: {
      total: x.total_rows, created: x.created_count, updated: x.updated_count, unchanged: x.unchanged_count, deactivated: x.deactivated_count,
      rejected: x.rejected_count, keptAdmins: x.kept_admin_count, ladderAdded: x.ladder_added, ladderChanged: x.ladder_changed,
      flaggedRelationships: x.flagged_relationships,
    },
  };
}

const scopeResource = (r: { programme_id: string | null; cohort_id: string | null }) => ({ programmeId: r.programme_id ?? undefined, cohortId: r.cohort_id ?? undefined });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Loads one run and checks the actor may view it; a missing, foreign or out-of-scope run are indistinguishable (INV-4.3). */
export async function loadRunFor(tx: Tx, actor: Actor, action: "import.view" | "import.run", runId: string): Promise<RunDb> {
  if (!UUID.test(runId)) throw new NotFoundError();
  const r = await tx.query<RunDb>(`${RUN_SELECT} WHERE r.id = $1`, [runId]);
  const row = r.rows[0];
  if (!row) throw new NotFoundError();
  authorize(actor, action, scopeResource(row));
  return row;
}

export async function residencyState(organisationId: string): Promise<{ signedOffAt: Date | null }> {
  const r = await withOrg(organisationId, (tx) => tx.query<{ residency_signoff_at: Date | null }>("SELECT residency_signoff_at FROM organisation WHERE id = $1", [organisationId]));
  return { signedOffAt: r.rows[0]?.residency_signoff_at ?? null };
}

/** Import history (AC-ADM-07.1). A PM sees only runs inside their scope. */
export async function listRuns(actor: Actor, limit = 100): Promise<RunSummary[]> {
  authorize(actor, "import.list");
  const r = await withOrg(actor.organisationId, (tx) => tx.query<RunDb>(`${RUN_SELECT} ORDER BY r.created_at DESC LIMIT $1`, [limit]));
  return r.rows.filter((x) => can(actor, "import.view", scopeResource(x))).map(toSummary);
}

export interface RunDetail {
  run: RunSummary;
  rejected: RunRow[];
  samples: Record<"create" | "update" | "deactivate", RunRow[]>;
  /** True when the run is a full-sync whose file has no usable row (confirming is refused). */
  blockedEmptyFullSync: boolean;
  signedOffAt: Date | null;
}

const SAMPLE = 20;

export async function getRun(actor: Actor, runId: string): Promise<RunDetail> {
  return withOrg(actor.organisationId, async (tx) => {
    const row = await loadRunFor(tx, actor, "import.view", runId);
    const run = toSummary(row);
    const rejected: RunRow[] = [];
    const samples: RunDetail["samples"] = { create: [], update: [], deactivate: [] };
    if (!run.rowsPurged) {
      const rej = await tx.query<{ row_number: number | null; outcome: Outcome; reason_code: string | null; raw: Record<string, string> }>(
        "SELECT row_number, outcome, reason_code, raw FROM import_row WHERE run_id = $1 AND outcome = 'reject' ORDER BY row_number LIMIT 500",
        [runId],
      );
      rejected.push(...rej.rows.map((x) => ({ rowNumber: x.row_number, outcome: x.outcome, reasonCode: x.reason_code, raw: x.raw })));
      for (const k of ["create", "update", "deactivate"] as const) {
        const s = await tx.query<{ row_number: number | null; outcome: Outcome; reason_code: string | null; raw: Record<string, string> }>(
          "SELECT row_number, outcome, reason_code, raw FROM import_row WHERE run_id = $1 AND outcome = $2 ORDER BY row_number NULLS LAST, id LIMIT $3",
          [runId, k, SAMPLE],
        );
        samples[k] = s.rows.map((x) => ({ rowNumber: x.row_number, outcome: x.outcome, reasonCode: x.reason_code, raw: x.raw }));
      }
    }
    const org = await tx.query<{ residency_signoff_at: Date | null }>("SELECT residency_signoff_at FROM organisation WHERE id = $1", [actor.organisationId]);
    const usable = run.counts.created + run.counts.updated + run.counts.unchanged;
    return { run, rejected, samples, blockedEmptyFullSync: run.fullSync && usable === 0, signedOffAt: org.rows[0]?.residency_signoff_at ?? null };
  });
}

export interface ScopeOption {
  value: string; // "org" | "p:<uuid>" | "c:<uuid>"
  kind: "org" | "programme" | "cohort";
  label: string;
}

/** The scopes the actor may run an import for: an org admin the whole organisation; a PM their own programmes/cohorts. */
export async function importScopeOptions(actor: Actor): Promise<ScopeOption[]> {
  authorize(actor, "import.list");
  const out: ScopeOption[] = [];
  if (can(actor, "import.run")) out.push({ value: "org", kind: "org", label: "" });
  const pmGrants = actor.roles.filter((g) => g.role === "pm" && g.scopeType !== "org");
  if (pmGrants.length === 0) return out;
  const names = await withOrg(actor.organisationId, async (tx) => {
    const p = await tx.query<{ id: string; name: string }>("SELECT id, name FROM programme WHERE id = ANY($1::uuid[]) ORDER BY name", [pmGrants.filter((g) => g.scopeType === "programme").map((g) => g.scopeId)]);
    const c = await tx.query<{ id: string; name: string; programme_name: string }>(
      "SELECT c.id, c.name, p.name AS programme_name FROM cohort c JOIN programme p ON p.id = c.programme_id WHERE c.id = ANY($1::uuid[]) ORDER BY p.name, c.name",
      [pmGrants.filter((g) => g.scopeType === "cohort").map((g) => g.scopeId)],
    );
    return { p: p.rows, c: c.rows };
  });
  for (const p of names.p) out.push({ value: `p:${p.id}`, kind: "programme", label: p.name });
  for (const c of names.c) out.push({ value: `c:${c.id}`, kind: "cohort", label: `${c.programme_name} / ${c.name}` });
  return out;
}

export const pageSizeFor = async (actor: Actor) => (await importSettings(actor.organisationId)).pageSize;
