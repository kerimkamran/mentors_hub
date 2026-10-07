/**
 * Directory CSV export (AC-ADM-22.3, A11). Columns come from an allowlist per role: an org admin gets the full set, a PM the
 * basic fields only (AC-ADM-22.4). Every cell is neutralised. The export is logged with the exporter's id and the filters
 * (ids and codes only; the typed search text is not kept, INV-3).
 */
import { audit } from "@/lib/audit";
import { withOrg } from "@/lib/db";
import { t, type Locale } from "@/lib/i18n";
import { authorize, can, type Actor } from "@/lib/permissions";
import { toCsv } from "./cells";
import { allDirectoryRows, parseFilters, type DirectoryFilters, type DirectoryRow } from "./directory";
import { importSettings } from "./settings";

export const EXPORT_COLUMNS = {
  full: ["employee_id", "display_name", "email", "department", "job_title", "status", "hire_date", "grade_bucket", "reporting_line", "participations"],
  basic: ["display_name", "department", "job_title", "status", "participations"],
} as const;
export type ExportColumn = (typeof EXPORT_COLUMNS)["full"][number];

export function exportCell(col: ExportColumn, r: DirectoryRow, l: Locale): string | number | null {
  switch (col) {
    case "employee_id": return r.employeeId ?? "";
    case "display_name": return r.displayName;
    case "email": return r.email ?? "";
    case "department": return r.department ?? "";
    case "job_title": return r.jobTitle ?? "";
    case "status": return t(l, `people.status.${r.status}`);
    case "hire_date": return r.hireDate ?? "";
    case "grade_bucket": return r.gradeBucket ?? "";
    case "reporting_line": return r.managerName ?? "";
    case "participations":
      return r.participations.map((p) => `${p.programmeName} / ${p.cohortName}: ${t(l, `people.kind.${p.kind}`)} (${t(l, `people.participation.${p.status}`)})`).join("; ");
  }
}

export async function exportDirectory(actor: Actor, requested: DirectoryFilters): Promise<{ filename: string; csv: string; rowCount: number }> {
  authorize(actor, "people.directory.export");
  const raw: Record<string, string | undefined> = { q: requested.q, department: requested.department, programme: requested.programmeId, participation: requested.participation, status: requested.status };
  const filters = parseFilters((n) => raw[n]); // only known codes and ids are filtered on and logged
  const full = can(actor, "people.hr.view");
  const level = full ? "full" : "basic";
  const columns = EXPORT_COLUMNS[level];
  const { maxExportRows } = await importSettings(actor.organisationId);
  return withOrg(actor.organisationId, async (tx) => {
    const { rows, departmentOk } = await allDirectoryRows(tx, actor, filters, full, maxExportRows);
    const loggedFilters = {
      has_query: !!(filters.q ?? "").trim(),
      department: filters.department && departmentOk ? filters.department : null,
      programme_id: filters.programmeId ?? null,
      participation: filters.participation ?? null,
      status: filters.status ?? null,
    };
    const log = await tx.query<{ id: string }>(
      "INSERT INTO directory_export_log (organisation_id, actor_membership_id, detail_level, row_count, filters) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [actor.organisationId, actor.membershipId, level, rows.length, JSON.stringify(loggedFilters)],
    );
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "people.export", objectType: "directory_export_log", objectId: log.rows[0]!.id });
    const header = columns.map((c) => t(actor.locale, `people.export.col.${c}`));
    const body = rows.map((r) => columns.map((c) => exportCell(c, r, actor.locale)));
    return { filename: `people-${log.rows[0]!.id.slice(0, 8)}.csv`, csv: toCsv([header, ...body]), rowCount: rows.length };
  });
}
