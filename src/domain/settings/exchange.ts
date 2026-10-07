/**
 * Settings export / import file (FR-ADM-006, AC-PRG-06.1…06.3). Schema-versioned, settings values only:
 * no people, no names, no ids, no free text. Parsing validates the WHOLE file and reports every problem.
 */
import type { ProgrammeType } from "../../lib/constants-programmes";
import { PROGRAMME_TYPES, REPORT_SCHEDULES, type ReportSchedule } from "../../lib/constants-programmes";
import { PROGRAMME_GROUPS, type GroupId, type Problem, type Values } from "./types";
import { validateGroup } from "./registry";

export const EXPORT_SCHEMA_VERSION = 1;
export const EXPORT_KIND = "mentorship-hub.programme-settings";
export const MAX_IMPORT_BYTES = 16 * 1024;

export interface SettingsFile {
  kind: typeof EXPORT_KIND;
  schemaVersion: number;
  programmeType: ProgrammeType;
  reportSchedule: ReportSchedule;
  groups: Partial<Record<GroupId, Values>>;
}

export function buildExport(programmeType: ProgrammeType, reportSchedule: ReportSchedule, groups: Partial<Record<GroupId, Values>>): SettingsFile {
  return { kind: EXPORT_KIND, schemaVersion: EXPORT_SCHEMA_VERSION, programmeType, reportSchedule, groups };
}

export type ImportProblem = Problem | { group: "file"; path: string; code: string; params?: Record<string, string | number> };

/** Result of parsing: either every problem, or the validated groups ready to diff and save. */
export function parseImport(text: string): { ok: true; file: SettingsFile } | { ok: false; problems: ImportProblem[] } {
  const fileProblem = (code: string, path = "", params?: Record<string, string | number>): { ok: false; problems: ImportProblem[] } => ({ ok: false, problems: [{ group: "file", path, code, params }] });
  if (text.length > MAX_IMPORT_BYTES) return fileProblem("file_too_large", "", { max: MAX_IMPORT_BYTES });
  let data: unknown;
  try { data = JSON.parse(text); } catch { return fileProblem("file_not_json"); }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return fileProblem("file_not_json");
  const d = data as Record<string, unknown>;
  const problems: ImportProblem[] = [];
  if (d.kind !== EXPORT_KIND) problems.push({ group: "file", path: "kind", code: "file_kind" });
  if (d.schemaVersion !== EXPORT_SCHEMA_VERSION) problems.push({ group: "file", path: "schemaVersion", code: "file_schema_version", params: { supported: EXPORT_SCHEMA_VERSION } });
  if (!PROGRAMME_TYPES.includes(d.programmeType as ProgrammeType)) problems.push({ group: "file", path: "programmeType", code: "option" });
  if (!REPORT_SCHEDULES.includes(d.reportSchedule as ReportSchedule)) problems.push({ group: "file", path: "reportSchedule", code: "option" });
  const known = new Set<string>(["kind", "schemaVersion", "programmeType", "reportSchedule", "groups"]);
  for (const k of Object.keys(d)) if (!known.has(k)) problems.push({ group: "file", path: k, code: "unknown" });
  const groups = d.groups;
  if (groups === null || typeof groups !== "object" || Array.isArray(groups)) problems.push({ group: "file", path: "groups", code: "object" });
  else {
    for (const [g, v] of Object.entries(groups as Record<string, unknown>)) {
      if (!(PROGRAMME_GROUPS as readonly string[]).includes(g)) problems.push({ group: "file", path: `groups.${g}`, code: "unknown" });
      else problems.push(...validateGroup(g as GroupId, "programme", v));
    }
  }
  if (problems.length) return { ok: false, problems };
  return { ok: true, file: d as unknown as SettingsFile };
}
