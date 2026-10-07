/**
 * Built-in programme templates (FR-PRG-003): Leadership, SparkLab and Open pre-fill cadence, capacity, weights, exclusion switches,
 * timings and the report schedule from the starting defaults in src/lib/constants. Pure.
 */
import { REPORT_SCHEDULE_BY_TYPE, type ProgrammeType, type ReportSchedule } from "../../lib/constants-programmes";
import { defaultValues } from "../settings/registry";
import { PROGRAMME_GROUPS, type GroupId, type Values } from "../settings/types";

export interface Template {
  type: ProgrammeType;
  reportSchedule: ReportSchedule;
  groups: Record<GroupId, Values>;
}

export function builtinTemplate(type: ProgrammeType): Template {
  const groups = {} as Record<GroupId, Values>;
  for (const g of PROGRAMME_GROUPS) groups[g] = defaultValues(g, "programme", type);
  return { type, reportSchedule: REPORT_SCHEDULE_BY_TYPE[type], groups };
}
