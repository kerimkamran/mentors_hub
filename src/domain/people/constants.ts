/**
 * Constants of slice S2 (people import). C-104 is a fixed retention period; the limits and defaults below are
 * STARTING DEFAULTS read through ./settings.ts so the settings centre (S3) can take them over (ARCHITECTURE rule 9).
 */
export const RAW_IMPORT_ROW_RETENTION_DAYS = 30; // C-104

export const IMPORT_DEFAULTS = {
  /** Largest accepted upload (bytes). */
  maxFileBytes: 5 * 1024 * 1024,
  /** Largest accepted number of data rows per file (reference scale C-120 is 2,000 people). */
  maxRows: 5000,
  /** Largest uncompressed size of an .xlsx package (zip-bomb guard). */
  maxUncompressedBytes: 50 * 1024 * 1024,
  /** Longest accepted cell (characters). */
  maxCellLength: 500,
  /** Number of grade buckets the ladder is divided into (FR-IMP-006). */
  gradeBuckets: 5,
  /** Rows per page in the directory and the import detail lists. */
  pageSize: 25,
  /** Largest CSV export (rows). */
  maxExportRows: 20000,
} as const;
