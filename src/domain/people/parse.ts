import { cleanCell } from "./cells";
import { mapHeaders, type Canonical } from "./columns";
import { ImportFileError, readRows } from "./spreadsheet";
import type { Cells, ParsedRow } from "./types";

export interface ParsedFile {
  format: "csv" | "xlsx";
  present: Canonical[];
  ignoredColumns: number;
  rows: ParsedRow[];
}

export interface ParseLimits {
  maxFileBytes: number;
  maxUncompressedBytes: number;
  maxRows: number;
  maxCellLength: number;
}

/**
 * Bytes → header-mapped, cleaned rows. Every cell is trimmed and formula-neutralised on the way in (FR-IMP-008).
 * Header problems (a required column missing, a column given twice) and size limits stop the whole file with a code;
 * row problems are reported per row later, by the plan.
 */
export async function parseFile(bytes: Uint8Array, limits: ParseLimits): Promise<ParsedFile> {
  const { rows: raw, format } = await readRows(bytes, limits);
  if (raw.length === 0) throw new ImportFileError("file_empty");
  const mapping = mapHeaders(raw[0]!.map((h) => String(h ?? "")));
  if (mapping.missing.length) throw new ImportFileError("missing_columns", mapping.missing);
  if (mapping.duplicated.length) throw new ImportFileError("duplicate_columns", mapping.duplicated);
  const data = raw.slice(1);
  if (data.length === 0) throw new ImportFileError("no_data_rows");
  if (data.length > limits.maxRows) throw new ImportFileError("too_many_rows");
  const rows: ParsedRow[] = data.map((cells, i) => {
    const out: Cells = {};
    mapping.byIndex.forEach((col, idx) => {
      if (col) out[col] = cleanCell(cells[idx]).slice(0, limits.maxCellLength + 1);
    });
    return { rowNumber: i + 2, cells: out };
  });
  return { format, present: mapping.present, ignoredColumns: mapping.ignored, rows };
}
