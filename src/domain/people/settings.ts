import { IMPORT_DEFAULTS, RAW_IMPORT_ROW_RETENTION_DAYS } from "./constants";

export interface ImportSettings {
  maxFileBytes: number;
  maxRows: number;
  maxUncompressedBytes: number;
  maxCellLength: number;
  gradeBuckets: number;
  pageSize: number;
  maxExportRows: number;
  rawRowRetentionDays: number;
}

/**
 * HOOK for the settings centre (S3). Until it exists these are the starting defaults; callers do not change
 * when S3 swaps the body for a lookup of the organisation's latest settings version.
 */
export async function importSettings(_organisationId: string): Promise<ImportSettings> {
  return { ...IMPORT_DEFAULTS, rawRowRetentionDays: RAW_IMPORT_ROW_RETENTION_DAYS };
}
