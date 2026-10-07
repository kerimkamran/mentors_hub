/**
 * People directory (US-ADM-22, SCR-28, FR-ADM-027): search with Azerbaijani/Russian folding, filters, participation status.
 * Read-only. An org admin sees everybody; a PM sees only people who participate in a programme or cohort they manage,
 * and only those participations. Grade bucket and reporting line are for org admins only (AC-ADM-22.2).
 * Notes, messages and goals' content are never selected here (INV-2).
 */
import { withOrg, type Tx } from "@/lib/db";
import { normalise } from "@/lib/search";
import { authorize, can, NotFoundError, type Actor } from "@/lib/permissions";
import { importSettings } from "./settings";

export const PARTICIPATION_STATUSES = ["invited", "enrolled", "withdrawn", "none"] as const;
export const MEMBERSHIP_STATUSES = ["active", "inactive", "invited"] as const;
export type ParticipationFilter = (typeof PARTICIPATION_STATUSES)[number];
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export interface DirectoryFilters {
  q?: string;
  department?: string;
  programmeId?: string;
  participation?: ParticipationFilter;
  status?: MembershipStatus;
}

export interface ParticipationInfo {
  programmeId: string;
  programmeName: string;
  cohortId: string;
  cohortName: string;
  kind: "mentor" | "mentee" | "team_member";
  status: "invited" | "enrolled" | "withdrawn";
}

export interface DirectoryRow {
  membershipId: string;
  displayName: string;
  department: string | null;
  jobTitle: string | null;
  status: MembershipStatus;
  participations: ParticipationInfo[];
  /** Org admin only. */
  email?: string;
  employeeId?: string | null;
  hireDate?: string | null;
  gradeBucket?: number | null;
  managerName?: string | null;
}

export interface Scope {
  all: boolean;
  programmeIds: string[];
  cohortIds: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What the actor may see, from their grants (never from the request). */
export function scopeOf(actor: Actor): Scope {
  const orgWide = actor.roles.some((g) => g.scopeType === "org" && (g.role === "org_admin" || g.role === "pm"));
  if (orgWide) return { all: true, programmeIds: [], cohortIds: [] };
  const pm = actor.roles.filter((g) => g.role === "pm");
  return {
    all: false,
    programmeIds: pm.filter((g) => g.scopeType === "programme" && g.scopeId).map((g) => g.scopeId!),
    cohortIds: pm.filter((g) => g.scopeType === "cohort" && g.scopeId).map((g) => g.scopeId!),
  };
}

const COLLATION: Record<Actor["locale"], string> = { az: '"az_ai"', ru: '"ru_ai"', en: '"und-x-icu"' };

class Sql {
  params: unknown[] = [];
  add(v: unknown): string {
    this.params.push(v);
    return `$${this.params.length}`;
  }
}

/** The shared WHERE clause of the list and the export. `full` = the actor may see HR fields. */
async function buildWhere(tx: Tx, actor: Actor, f: DirectoryFilters, full: boolean): Promise<{ where: string; params: unknown[]; departmentOk: boolean }> {
  const scope = scopeOf(actor);
  const sql = new Sql();
  const conds: string[] = [];

  // Participation conditions are applied to ONE participation row, so a PM's filter cannot reveal programmes outside their scope.
  const partConds: string[] = [];
  if (!scope.all) partConds.push(`(c.programme_id = ANY(${sql.add(scope.programmeIds)}::uuid[]) OR c.id = ANY(${sql.add(scope.cohortIds)}::uuid[]))`);
  if (f.programmeId) partConds.push(`c.programme_id = ${sql.add(UUID.test(f.programmeId) ? f.programmeId : "00000000-0000-0000-0000-000000000000")}`);
  if (f.participation && f.participation !== "none") partConds.push(`pa.status = ${sql.add(f.participation)}`);
  if (f.participation === "none") conds.push(scope.all ? "NOT EXISTS (SELECT 1 FROM participation x WHERE x.membership_id = m.id)" : "FALSE");
  else if (partConds.length)
    conds.push(`EXISTS (SELECT 1 FROM participation pa JOIN cohort c ON c.id = pa.cohort_id AND c.organisation_id = pa.organisation_id WHERE pa.membership_id = m.id AND ${partConds.join(" AND ")})`);

  if (f.status && (MEMBERSHIP_STATUSES as readonly string[]).includes(f.status)) conds.push(`m.status = ${sql.add(f.status)}`);

  let departmentOk = true;
  if (f.department) {
    const known = await departmentsIn(tx, actor);
    departmentOk = known.some((d) => normalise(d) === normalise(f.department!));
    conds.push(departmentOk ? `mh_normalise(coalesce(p.department, '')) = ${sql.add(normalise(f.department))}` : "FALSE");
  }

  // Every word must be found in the name, department (and, for org admins, the email or employee id) after folding.
  for (const word of normalise(f.q ?? "").split(/\s+/).filter(Boolean).slice(0, 8)) {
    const p = sql.add(word);
    const parts = [`strpos(mh_normalise(p.display_name), ${p}) > 0`, `strpos(mh_normalise(coalesce(p.department, '')), ${p}) > 0`];
    if (full) parts.push(`strpos(i.email, ${p}) > 0`, `strpos(lower(coalesce(h.employee_id, '')), ${p}) > 0`);
    conds.push(`(${parts.join(" OR ")})`);
  }
  return { where: conds.length ? `WHERE ${conds.join(" AND ")}` : "", params: sql.params, departmentOk };
}

/** Departments of the people the actor may see (for the filter list). */
async function departmentsIn(tx: Tx, actor: Actor): Promise<string[]> {
  const scope = scopeOf(actor);
  const r = scope.all
    ? await tx.query<{ department: string }>("SELECT DISTINCT department FROM person_profile WHERE department IS NOT NULL ORDER BY department")
    : await tx.query<{ department: string }>(
        `SELECT DISTINCT p.department FROM person_profile p
         WHERE p.department IS NOT NULL AND EXISTS (
           SELECT 1 FROM participation pa JOIN cohort c ON c.id = pa.cohort_id AND c.organisation_id = pa.organisation_id
           WHERE pa.membership_id = p.membership_id AND (c.programme_id = ANY($1::uuid[]) OR c.id = ANY($2::uuid[])))
         ORDER BY p.department`,
        [scope.programmeIds, scope.cohortIds],
      );
  return r.rows.map((x) => x.department);
}

async function programmesIn(tx: Tx, actor: Actor): Promise<{ id: string; name: string }[]> {
  const scope = scopeOf(actor);
  const r = scope.all
    ? await tx.query<{ id: string; name: string }>("SELECT id, name FROM programme ORDER BY name")
    : await tx.query<{ id: string; name: string }>(
        "SELECT DISTINCT p.id, p.name FROM programme p LEFT JOIN cohort c ON c.programme_id = p.id WHERE p.id = ANY($1::uuid[]) OR c.id = ANY($2::uuid[]) ORDER BY p.name",
        [scope.programmeIds, scope.cohortIds],
      );
  return r.rows;
}

const HR_JOINS = `LEFT JOIN hr_record h ON h.membership_id = m.id
  LEFT JOIN grade_ladder g ON g.id = h.grade_id
  LEFT JOIN person_profile mp ON mp.membership_id = h.manager_membership_id`;
const BASE_FROM = `FROM membership m
  JOIN person_profile p ON p.membership_id = m.id
  JOIN identity i ON i.id = m.identity_id`;

interface DbRow {
  membership_id: string; display_name: string; department: string | null; job_title: string | null; status: MembershipStatus;
  email?: string; employee_id?: string | null; hire_date?: string | null; bucket?: number | null; manager_name?: string | null;
}

async function loadParticipations(tx: Tx, actor: Actor, ids: string[]): Promise<Map<string, ParticipationInfo[]>> {
  const out = new Map<string, ParticipationInfo[]>();
  if (ids.length === 0) return out;
  const scope = scopeOf(actor);
  const params: unknown[] = [ids];
  let scopeSql = "";
  if (!scope.all) {
    params.push(scope.programmeIds, scope.cohortIds);
    scopeSql = "AND (pr.id = ANY($2::uuid[]) OR c.id = ANY($3::uuid[]))";
  }
  const r = await tx.query<{ membership_id: string; kind: ParticipationInfo["kind"]; status: ParticipationInfo["status"]; cohort_id: string; cohort_name: string; programme_id: string; programme_name: string }>(
    `SELECT pa.membership_id, pa.kind, pa.status, c.id AS cohort_id, c.name AS cohort_name, pr.id AS programme_id, pr.name AS programme_name
     FROM participation pa
     JOIN cohort c ON c.id = pa.cohort_id AND c.organisation_id = pa.organisation_id
     JOIN programme pr ON pr.id = c.programme_id AND pr.organisation_id = c.organisation_id
     WHERE pa.membership_id = ANY($1::uuid[]) ${scopeSql}
     ORDER BY pr.name, c.name, pa.kind`,
    params,
  );
  for (const x of r.rows) {
    const list = out.get(x.membership_id) ?? [];
    list.push({ programmeId: x.programme_id, programmeName: x.programme_name, cohortId: x.cohort_id, cohortName: x.cohort_name, kind: x.kind, status: x.status });
    out.set(x.membership_id, list);
  }
  return out;
}

const toRow = (x: DbRow, parts: Map<string, ParticipationInfo[]>, full: boolean): DirectoryRow => ({
  membershipId: x.membership_id,
  displayName: x.display_name,
  department: x.department,
  jobTitle: x.job_title,
  status: x.status,
  participations: parts.get(x.membership_id) ?? [],
  ...(full ? { email: x.email, employeeId: x.employee_id ?? null, hireDate: x.hire_date ?? null, gradeBucket: x.bucket ?? null, managerName: x.manager_name ?? null } : {}),
});

export interface DirectoryPage {
  rows: DirectoryRow[];
  total: number;
  page: number;
  pageSize: number;
  departments: string[];
  programmes: { id: string; name: string }[];
  canSeeHr: boolean;
  canExport: boolean;
}

export async function searchDirectory(actor: Actor, filters: DirectoryFilters, page = 1): Promise<DirectoryPage> {
  authorize(actor, "people.directory.view");
  const full = can(actor, "people.hr.view");
  const { pageSize } = await importSettings(actor.organisationId);
  const pageNo = Math.max(1, Math.floor(page) || 1);
  return withOrg(actor.organisationId, async (tx) => {
    const { where, params } = await buildWhere(tx, actor, filters, full);
    const joins = `${BASE_FROM} ${full ? HR_JOINS : ""}`;
    const total = await tx.query<{ n: number }>(`SELECT count(*)::int AS n ${joins} ${where}`, params);
    const select = full
      ? "m.id AS membership_id, p.display_name, p.department, p.job_title, m.status, i.email, h.employee_id, h.hire_date::text AS hire_date, g.bucket, mp.display_name AS manager_name"
      : "m.id AS membership_id, p.display_name, p.department, p.job_title, m.status";
    const order = actor.locale === "en" ? "mh_normalise(p.display_name), p.display_name" : `p.display_name COLLATE ${COLLATION[actor.locale]}`;
    const rows = await tx.query<DbRow>(
      `SELECT ${select} ${joins} ${where} ORDER BY ${order}, m.id LIMIT ${pageSize} OFFSET ${(pageNo - 1) * pageSize}`,
      params,
    );
    const parts = await loadParticipations(tx, actor, rows.rows.map((r) => r.membership_id));
    return {
      rows: rows.rows.map((r) => toRow(r, parts, full)),
      total: total.rows[0]!.n,
      page: pageNo,
      pageSize,
      departments: await departmentsIn(tx, actor),
      programmes: await programmesIn(tx, actor),
      canSeeHr: full,
      canExport: can(actor, "people.directory.export"),
    };
  });
}

/** Every matching row (no paging), for the CSV export. Same filters and same visibility as the list. */
export async function allDirectoryRows(tx: Tx, actor: Actor, filters: DirectoryFilters, full: boolean, max: number): Promise<{ rows: DirectoryRow[]; departmentOk: boolean }> {
  const { where, params, departmentOk } = await buildWhere(tx, actor, filters, full);
  const joins = `${BASE_FROM} ${full ? HR_JOINS : ""}`;
  const select = full
    ? "m.id AS membership_id, p.display_name, p.department, p.job_title, m.status, i.email, h.employee_id, h.hire_date::text AS hire_date, g.bucket, mp.display_name AS manager_name"
    : "m.id AS membership_id, p.display_name, p.department, p.job_title, m.status";
  const rows = await tx.query<DbRow>(`SELECT ${select} ${joins} ${where} ORDER BY mh_normalise(p.display_name), p.display_name, m.id LIMIT ${max}`, params);
  const parts = await loadParticipations(tx, actor, rows.rows.map((r) => r.membership_id));
  return { rows: rows.rows.map((r) => toRow(r, parts, full)), departmentOk };
}

// ---------------------------------------------------------------- one person (AC-ADM-22.2)
export interface PersonRecord extends DirectoryRow {
  directReports?: number;
  canDeactivate: boolean;
}

export async function getPerson(actor: Actor, membershipId: string): Promise<PersonRecord> {
  authorize(actor, "people.directory.view");
  if (!UUID.test(membershipId)) throw new NotFoundError();
  const full = can(actor, "people.hr.view");
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<DbRow>(
      `SELECT m.id AS membership_id, p.display_name, p.department, p.job_title, m.status, i.email, h.employee_id, h.hire_date::text AS hire_date, g.bucket, mp.display_name AS manager_name
       ${BASE_FROM} ${HR_JOINS} WHERE m.id = $1`,
      [membershipId],
    );
    const row = r.rows[0];
    if (!row) throw new NotFoundError();
    // The participations come from the database; a PM needs at least one inside their scope.
    const parts = await loadParticipations(tx, actor, [membershipId]);
    const list = parts.get(membershipId) ?? [];
    if (!scopeOf(actor).all && list.length === 0) throw new NotFoundError();
    authorizeRecord(actor, list);
    let directReports: number | undefined;
    if (full) directReports = (await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM hr_record WHERE manager_membership_id = $1", [membershipId])).rows[0]!.n;
    return { ...toRow(row, parts, full), directReports, canDeactivate: can(actor, "people.deactivate") && row.status !== "inactive" };
  });
}

function authorizeRecord(actor: Actor, list: ParticipationInfo[]) {
  if (can(actor, "people.record.view")) return; // org admin, or a PM with an organisation-wide grant
  if (list.some((p) => can(actor, "people.record.view", { programmeId: p.programmeId, cohortId: p.cohortId }))) return;
  throw new NotFoundError();
}

/** Turns raw query/form values into filters: only known codes and UUIDs get through (the export logs them). */
export function parseFilters(get: (name: string) => string | null | undefined): DirectoryFilters {
  const s = (name: string, max: number) => (get(name) ?? "").trim().slice(0, max) || undefined;
  const participation = s("participation", 20);
  const status = s("status", 20);
  const programmeId = s("programme", 40);
  return {
    q: s("q", 100),
    department: s("department", 200),
    programmeId: programmeId && UUID.test(programmeId) ? programmeId : undefined,
    participation: (PARTICIPATION_STATUSES as readonly string[]).includes(participation ?? "") ? (participation as ParticipationFilter) : undefined,
    status: (MEMBERSHIP_STATUSES as readonly string[]).includes(status ?? "") ? (status as MembershipStatus) : undefined,
  };
}
