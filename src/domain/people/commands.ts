/**
 * Write side of the people import (US-ADM-07, FR-IMP-001…011): preview (dry run), confirm, error file, deactivation,
 * and the retention purge of raw rows. Every function authorises first (INV-4), runs through withOrg (INV-1) and audits
 * by id and status only (INV-3).
 */
import { audit } from "@/lib/audit";
import { withOrg, type Tx } from "@/lib/db";
import { t, type Locale } from "@/lib/i18n";
import { authorize, NotFoundError, type Actor, type Resource } from "@/lib/permissions";
import { toCsv } from "./cells";
import { CANONICAL, columnHeader, type Canonical } from "./columns";
import { parseFile } from "./parse";
import { planImport } from "./plan";
import { loadRunFor } from "./queries";
import { importSettings } from "./settings";
import { ImportFileError } from "./spreadsheet";
import type { ExistingByEmail, ExistingPerson, LadderEntry, ParsedRow, Plan } from "./types";

// ---------------------------------------------------------------- errors
export type BlockReason = "residency" | "empty_full_sync" | "expired" | "already_applied";
/** The run cannot proceed (fail closed, INV-8). The page shows the reason code as text. */
export class ImportBlockedError extends Error {
  constructor(readonly reason: BlockReason) {
    super(`import blocked: ${reason}`);
  }
}
export { ImportFileError };

export interface PreviewInput {
  bytes: Uint8Array;
  /** "org" for the whole organisation (org admins), or a programme/cohort the actor manages. */
  scope: { programmeId?: string; cohortId?: string } | null;
  fullSync: boolean;
  /** The file holds only synthetic or pseudonymised data (INV-8.3). */
  isSynthetic: boolean;
}

// ---------------------------------------------------------------- state loading
async function loadPlanInput(tx: Tx, actor: Actor, rows: ParsedRow[], present: Canonical[], fullSync: boolean) {
  const orgId = actor.organisationId;
  const settings = await importSettings(orgId);
  const domains = await tx.query<{ domain: string }>("SELECT domain FROM organisation_domain WHERE organisation_id = $1", [orgId]);
  const stored = await tx.query<{
    membership_id: string; employee_id: string; email: string; display_name: string | null; department: string | null; job_title: string | null;
    hire_date: string | null; grade_name: string | null; manager_employee_id: string | null; hr_status: "active" | "inactive"; membership_status: ExistingPerson["membershipStatus"];
  }>(
    `SELECT h.membership_id, h.employee_id, i.email, p.display_name, p.department, p.job_title, h.hire_date::text AS hire_date, g.name AS grade_name,
            mg.employee_id AS manager_employee_id, h.status AS hr_status, m.status AS membership_status
     FROM hr_record h
     JOIN membership m ON m.id = h.membership_id
     JOIN identity i ON i.id = m.identity_id
     LEFT JOIN person_profile p ON p.membership_id = h.membership_id
     LEFT JOIN grade_ladder g ON g.id = h.grade_id
     LEFT JOIN hr_record mg ON mg.membership_id = h.manager_membership_id`,
  );
  const existing: ExistingPerson[] = stored.rows.map((x) => ({
    membershipId: x.membership_id, employeeId: x.employee_id, email: x.email, displayName: x.display_name, department: x.department, jobTitle: x.job_title,
    hireDate: x.hire_date, gradeName: x.grade_name, managerEmployeeId: x.manager_employee_id, hrStatus: x.hr_status, membershipStatus: x.membership_status,
  }));
  const emails = [...new Set(rows.map((r) => (r.cells.email ?? "").trim().toLowerCase()).filter(Boolean))];
  const held = await tx.query<{ email: string; membership_id: string; employee_id: string | null; status: ExistingByEmail["membershipStatus"] }>(
    `SELECT i.email, m.id AS membership_id, h.employee_id, m.status
     FROM identity i JOIN membership m ON m.identity_id = i.id LEFT JOIN hr_record h ON h.membership_id = m.id
     WHERE i.email = ANY($1::text[])`,
    [emails],
  );
  const byEmail = new Map<string, ExistingByEmail>(held.rows.map((x) => [x.email, { membershipId: x.membership_id, employeeId: x.employee_id, membershipStatus: x.status }]));
  const ladderRows = await tx.query<{ name: string; source_order: string | null; order_index: number; bucket: number }>("SELECT name, source_order, order_index, bucket FROM grade_ladder ORDER BY order_index");
  const ladder: LadderEntry[] = ladderRows.rows.map((x) => ({ name: x.name, sourceOrder: x.source_order === null ? null : Number(x.source_order), orderIndex: x.order_index, bucket: x.bucket }));
  const admins = await tx.query<{ membership_id: string }>("SELECT membership_id FROM role_grant WHERE role = 'org_admin' AND scope_type = 'org'");
  const protectedIds = new Set([...admins.rows.map((a) => a.membership_id), actor.membershipId]);
  return {
    rows, presentColumns: new Set(present), domains: new Set(domains.rows.map((d) => d.domain)), existing, byEmail, ladder, fullSync,
    protectedMembershipIds: protectedIds, gradeBuckets: settings.gradeBuckets, maxCell: settings.maxCellLength,
  };
}

/** Active relationships that involve a person who is about to be deactivated (FR-IMP-011: flagged for the PM). */
async function countFlaggedRelationships(tx: Tx, membershipIds: string[]): Promise<number> {
  if (membershipIds.length === 0) return 0;
  const r = await tx.query<{ n: number }>(
    `SELECT count(DISTINCT rel.id)::int AS n
     FROM relationship rel
     JOIN relationship_member rm ON rm.relationship_id = rel.id AND rm.organisation_id = rel.organisation_id
     JOIN participation pa ON pa.id = rm.participation_id AND pa.organisation_id = rm.organisation_id
     WHERE rel.status = 'active' AND pa.membership_id = ANY($1::uuid[])`,
    [membershipIds],
  );
  return r.rows[0]!.n;
}

async function storeRows(tx: Tx, orgId: string, runId: string, plan: Plan) {
  await tx.query("DELETE FROM import_row WHERE run_id = $1", [runId]);
  const all = plan.results;
  for (let i = 0; i < all.length; i += 500) {
    const chunk = all.slice(i, i + 500);
    await tx.query(
      `INSERT INTO import_row (organisation_id, run_id, row_number, raw, outcome, reason_code)
       SELECT $1::uuid, $2::uuid, t.n, t.raw::jsonb, t.outcome, t.reason
       FROM unnest($3::int[], $4::text[], $5::text[], $6::text[]) AS t(n, raw, outcome, reason)`,
      [orgId, runId, chunk.map((x) => x.rowNumber), chunk.map((x) => JSON.stringify(x.raw)), chunk.map((x) => x.outcome), chunk.map((x) => x.reason ?? null)],
    );
  }
}

const countsSql = `total_rows = $2, created_count = $3, updated_count = $4, unchanged_count = $5, deactivated_count = $6, rejected_count = $7,
  kept_admin_count = $8, ladder_added = $9, ladder_changed = $10, flagged_relationships = $11`;
const countsParams = (plan: Plan, flagged: number, totalRows: number) => [
  totalRows, plan.counts.created, plan.counts.updated, plan.counts.unchanged, plan.counts.deactivated, plan.counts.rejected,
  plan.counts.keptAdmins, plan.ladderAdded, plan.ladderChanged, flagged,
];

async function assertResidency(tx: Tx, orgId: string, isSynthetic: boolean) {
  if (isSynthetic) return;
  const r = await tx.query<{ residency_signoff_at: Date | null }>("SELECT residency_signoff_at FROM organisation WHERE id = $1", [orgId]);
  if (!r.rows[0]?.residency_signoff_at) throw new ImportBlockedError("residency"); // INV-8.3
}

async function resolveScope(tx: Tx, scope: PreviewInput["scope"]): Promise<{ programmeId: string | null; cohortId: string | null; resource: Resource }> {
  if (!scope || (!scope.programmeId && !scope.cohortId)) return { programmeId: null, cohortId: null, resource: {} };
  if (scope.cohortId) {
    const c = await tx.query<{ programme_id: string }>("SELECT programme_id FROM cohort WHERE id = $1", [scope.cohortId]);
    if (!c.rows[0]) throw new NotFoundError();
    return { programmeId: c.rows[0].programme_id, cohortId: scope.cohortId, resource: { programmeId: c.rows[0].programme_id, cohortId: scope.cohortId } };
  }
  const p = await tx.query("SELECT 1 FROM programme WHERE id = $1", [scope.programmeId]);
  if (!p.rowCount) throw new NotFoundError();
  return { programmeId: scope.programmeId!, cohortId: null, resource: { programmeId: scope.programmeId } };
}

// ---------------------------------------------------------------- 1. preview (dry run, FR-IMP-003)
/**
 * Parses and validates a file and stores the dry-run (run + raw rows). Nothing about people is written.
 * Real data is refused until the residency sign-off exists (INV-8.3): the raw rows would otherwise sit in the database.
 */
export async function createImportPreview(actor: Actor, input: PreviewInput): Promise<string> {
  const settings = await importSettings(actor.organisationId);
  // Resolve and authorise the scope first, so an unauthorised caller learns nothing about the file.
  const scope = await withOrg(actor.organisationId, async (tx) => {
    const s = await resolveScope(tx, input.scope);
    authorize(actor, "import.run", s.resource);
    if (input.fullSync) authorize(actor, "import.full_sync");
    return s;
  });
  const gate = await withOrg(actor.organisationId, async (tx) => {
    try {
      await assertResidency(tx, actor.organisationId, input.isSynthetic);
      return null;
    } catch (e) {
      if (e instanceof ImportBlockedError) return e;
      throw e;
    }
  });
  if (gate) {
    await withOrg(actor.organisationId, (tx) => audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "import.preview", objectType: "import_run", status: "failed" }));
    throw gate;
  }
  const parsed = await parseFile(input.bytes, settings);
  return withOrg(actor.organisationId, async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`import:${actor.organisationId}`]);
    const planInput = await loadPlanInput(tx, actor, parsed.rows, parsed.present, input.fullSync);
    const plan = planImport(planInput);
    const flagged = await countFlaggedRelationships(tx, plan.results.filter((r) => r.outcome === "deactivate").map((r) => r.membershipId!));
    const run = await tx.query<{ id: string }>(
      `INSERT INTO import_run (organisation_id, programme_id, cohort_id, started_by, source_format, full_sync, is_synthetic, present_columns, ignored_columns,
                               total_rows, created_count, updated_count, unchanged_count, deactivated_count, rejected_count, kept_admin_count, ladder_added, ladder_changed, flagged_relationships)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING id`,
      [
        actor.organisationId, scope.programmeId, scope.cohortId, actor.membershipId, parsed.format, input.fullSync, input.isSynthetic, parsed.present, parsed.ignoredColumns,
        parsed.rows.length, plan.counts.created, plan.counts.updated, plan.counts.unchanged, plan.counts.deactivated, plan.counts.rejected, plan.counts.keptAdmins,
        plan.ladderAdded, plan.ladderChanged, flagged,
      ],
    );
    const runId = run.rows[0]!.id;
    await storeRows(tx, actor.organisationId, runId, plan);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "import.preview", objectType: "import_run", objectId: runId });
    return runId;
  });
}

// ---------------------------------------------------------------- 2. confirm (idempotent upsert, FR-IMP-004)
export type ConfirmResult = { status: "applied" } | { status: "stale" };

/**
 * Applies a previewed run. The plan is recomputed against the current database inside one transaction; if it no longer
 * matches what the person previewed, nothing is written, the preview is refreshed and `stale` is returned so they can
 * confirm again knowingly. Re-running the same file produces only "unchanged" rows and writes nothing.
 */
export async function confirmImport(actor: Actor, runId: string): Promise<ConfirmResult> {
  try {
    return await withOrg(actor.organisationId, async (tx) => {
      const run = await loadRunFor(tx, actor, "import.run", runId);
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`import:${actor.organisationId}`]);
      const locked = await tx.query<{ state: string; rows_purged_at: Date | null }>("SELECT state, rows_purged_at FROM import_run WHERE id = $1 FOR UPDATE", [runId]);
      if (locked.rows[0]!.state !== "previewed") throw new ImportBlockedError("already_applied");
      if (locked.rows[0]!.rows_purged_at) throw new ImportBlockedError("expired");
      if (run.full_sync) authorize(actor, "import.full_sync");
      await assertResidency(tx, actor.organisationId, run.is_synthetic);

      const stored = await tx.query<{ row_number: number | null; raw: Record<string, string>; outcome: string }>("SELECT row_number, raw, outcome FROM import_row WHERE run_id = $1 ORDER BY id", [runId]);
      const rows: ParsedRow[] = stored.rows.filter((x) => x.row_number !== null).map((x) => ({ rowNumber: x.row_number!, cells: x.raw as ParsedRow["cells"] })).sort((a, b) => a.rowNumber - b.rowNumber);
      const plan = planImport(await loadPlanInput(tx, actor, rows, run.present_columns as Canonical[], run.full_sync));
      if (plan.blocked) throw new ImportBlockedError(plan.blocked);
      const flagged = await countFlaggedRelationships(tx, plan.results.filter((r) => r.outcome === "deactivate").map((r) => r.membershipId!));

      // What the person previewed, row by row, against what would happen now.
      const key = (n: number | null, raw: Record<string, string>, outcome: string) => `${n ?? `d:${raw.employee_id}`}:${outcome}`;
      const previewed = stored.rows.map((x) => key(x.row_number, x.raw, x.outcome)).sort().join("|");
      const current = plan.results.map((x) => key(x.rowNumber, x.raw, x.outcome)).sort().join("|");
      if (previewed !== current || run.ladder_added !== plan.ladderAdded) {
        await storeRows(tx, actor.organisationId, runId, plan);
        await tx.query(`UPDATE import_run SET ${countsSql} WHERE id = $1`, [runId, ...countsParams(plan, flagged, rows.length)]);
        return { status: "stale" } as const;
      }

      await applyPlan(tx, actor, runId, plan, new Set(run.present_columns));
      await storeRows(tx, actor.organisationId, runId, plan);
      await tx.query(`UPDATE import_run SET ${countsSql}, mode = 'confirmed', state = 'applied', confirmed_by = $12, confirmed_at = now() WHERE id = $1`, [
        runId, ...countsParams(plan, flagged, rows.length), actor.membershipId,
      ]);
      await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "import.confirm", objectType: "import_run", objectId: runId });
      return { status: "applied" } as const;
    });
  } catch (e) {
    if (e instanceof ImportBlockedError && e.reason === "residency") {
      await withOrg(actor.organisationId, (tx) => audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "import.confirm", objectType: "import_run", objectId: runId, status: "failed" }));
    }
    throw e;
  }
}

async function applyPlan(tx: Tx, actor: Actor, runId: string, plan: Plan, present: ReadonlySet<string>) {
  const orgId = actor.organisationId;
  // Grade ladder first (people point at it).
  if (plan.ladderAdded > 0) {
    for (const e of plan.ladder)
      await tx.query(
        `INSERT INTO grade_ladder (organisation_id, name, source_order, order_index, bucket) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organisation_id, name) DO UPDATE SET source_order = EXCLUDED.source_order, order_index = EXCLUDED.order_index, bucket = EXCLUDED.bucket`,
        [orgId, e.name, e.sourceOrder, e.orderIndex, e.bucket],
      );
  }
  const gradeIds = new Map((await tx.query<{ id: string; name: string }>("SELECT id, name FROM grade_ladder")).rows.map((g) => [g.name, g.id]));

  const writes = plan.results.filter((r) => (r.outcome === "create" || r.outcome === "update") && r.row);
  const membershipByEmployee = new Map<string, string>();
  for (const r of writes) {
    const n = r.row!;
    let identity = (await tx.query<{ id: string }>("SELECT id FROM identity WHERE email = $1", [n.email])).rows[0]?.id;
    identity ??= (await tx.query<{ id: string }>("INSERT INTO identity (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id", [n.email])).rows[0]!.id;
    const m = (await tx.query<{ id: string; status: string }>("SELECT id, status FROM membership WHERE identity_id = $1", [identity])).rows[0];
    let membershipId: string;
    if (!m) {
      membershipId = (await tx.query<{ id: string }>("INSERT INTO membership (organisation_id, identity_id, status, source) VALUES ($1, $2, $3, 'import') RETURNING id", [orgId, identity, n.status])).rows[0]!.id;
    } else {
      membershipId = m.id;
      if (m.status !== n.status) await tx.query("UPDATE membership SET status = $2 WHERE id = $1", [membershipId, n.status]);
    }
    membershipByEmployee.set(n.employeeId, membershipId);
    await tx.query(
      `INSERT INTO person_profile (membership_id, organisation_id, display_name, department, job_title) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (membership_id) DO UPDATE SET display_name = EXCLUDED.display_name,
         department = CASE WHEN $6 THEN EXCLUDED.department ELSE person_profile.department END,
         job_title = CASE WHEN $7 THEN EXCLUDED.job_title ELSE person_profile.job_title END`,
      [membershipId, orgId, n.displayName, n.department, n.jobTitle, present.has("department"), present.has("job_title")],
    );
    await tx.query(
      `INSERT INTO hr_record (membership_id, organisation_id, employee_id, hire_date, grade_id, status, last_import_run_id) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (membership_id) DO UPDATE SET employee_id = EXCLUDED.employee_id, status = EXCLUDED.status, last_import_run_id = EXCLUDED.last_import_run_id, updated_at = now(),
         hire_date = CASE WHEN $8 THEN EXCLUDED.hire_date ELSE hr_record.hire_date END,
         grade_id = CASE WHEN $9 THEN EXCLUDED.grade_id ELSE hr_record.grade_id END`,
      [membershipId, orgId, n.employeeId, n.hireDate, n.grade ? (gradeIds.get(n.grade) ?? null) : null, n.status, runId, present.has("hire_date"), present.has("grade")],
    );
  }
  // Manager links in a second pass: a manager may be created by the same file (FR-IMP-005).
  if (present.has("manager_employee_id")) {
    for (const r of writes)
      await tx.query(
        `UPDATE hr_record SET manager_membership_id = (SELECT m.membership_id FROM hr_record m WHERE m.employee_id = $2), updated_at = now()
         WHERE membership_id = $1 AND manager_membership_id IS DISTINCT FROM (SELECT m.membership_id FROM hr_record m WHERE m.employee_id = $2)`,
        [membershipByEmployee.get(r.row!.employeeId), r.row!.managerEmployeeId],
      );
  }
  // Absent people (full sync) are deactivated, never deleted (FR-IMP-011).
  for (const r of plan.results.filter((x) => x.outcome === "deactivate")) {
    await tx.query("UPDATE membership SET status = 'inactive' WHERE id = $1 AND status <> 'inactive'", [r.membershipId]);
    await tx.query("UPDATE hr_record SET status = 'inactive', last_import_run_id = $2, updated_at = now() WHERE membership_id = $1", [r.membershipId, runId]);
  }
}

// ---------------------------------------------------------------- 3. error file (FR-IMP-007, AC-ADM-07.2)
/** CSV of the rejected rows with a reason per row, in the actor's language, every cell neutralised. Logged by run id. */
export async function exportErrorFile(actor: Actor, runId: string): Promise<{ filename: string; csv: string }> {
  return withOrg(actor.organisationId, async (tx) => {
    const run = await loadRunFor(tx, actor, "import.view", runId);
    if (run.rows_purged_at || run.rejected_count === 0) throw new NotFoundError(); // raw rows are gone after C-104 (AC-ADM-07.4)
    const rows = await tx.query<{ row_number: number; reason_code: string; raw: Record<string, string> }>(
      "SELECT row_number, reason_code, raw FROM import_row WHERE run_id = $1 AND outcome = 'reject' ORDER BY row_number",
      [runId],
    );
    const l: Locale = actor.locale;
    const header = [t(l, "people.error_file.row"), t(l, "people.error_file.reason_code"), t(l, "people.error_file.reason"), ...CANONICAL.map((c) => columnHeader(c, l))];
    const body = rows.rows.map((r) => [r.row_number, r.reason_code, t(l, `people.import.reason.${r.reason_code}`), ...CANONICAL.map((c) => r.raw[c] ?? "")]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "import.error_file", objectType: "import_run", objectId: runId });
    return { filename: `import-errors-${runId.slice(0, 8)}.csv`, csv: toCsv([header, ...body]) };
  });
}

// ---------------------------------------------------------------- 4. deactivate a person (matrix §4.2: org admin)
export async function deactivatePerson(actor: Actor, membershipId: string): Promise<void> {
  authorize(actor, "people.deactivate");
  await withOrg(actor.organisationId, async (tx) => {
    const m = await tx.query<{ status: string }>("SELECT status FROM membership WHERE id = $1 FOR UPDATE", [membershipId]);
    if (!m.rows[0]) throw new NotFoundError();
    // Never lock out the last organisation admin, nor the person doing it.
    if (membershipId === actor.membershipId) throw new NotFoundError();
    const admin = await tx.query("SELECT 1 FROM role_grant WHERE membership_id = $1 AND role = 'org_admin' AND scope_type = 'org'", [membershipId]);
    if (admin.rowCount) throw new NotFoundError();
    await tx.query("UPDATE membership SET status = 'inactive' WHERE id = $1", [membershipId]);
    await tx.query("UPDATE hr_record SET status = 'inactive', updated_at = now() WHERE membership_id = $1", [membershipId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "person.deactivate", objectType: "membership", objectId: membershipId });
  });
}
