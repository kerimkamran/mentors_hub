/**
 * Reading and writing the two accepted formats (FR-IMP-001): CSV and Excel (.xlsx). Reading returns plain strings (the
 * cells are cleaned and neutralised later, in parseFile); writing neutralises every cell (FR-IMP-008).
 */
import ExcelJS from "exceljs";
import { neutralise, toCsv } from "./cells";
import { decodeText, parseCsv, CsvError } from "./csv";

export type FileErrorCode =
  | "file_too_large"
  | "file_empty"
  | "file_encoding"
  | "csv_malformed"
  | "xlsx_unreadable"
  | "xlsx_too_large"
  | "too_many_rows"
  | "missing_columns"
  | "duplicate_columns"
  | "no_data_rows";

export class ImportFileError extends Error {
  constructor(readonly code: FileErrorCode, readonly detail: string[] = []) {
    super(code);
  }
}

const isZip = (b: Uint8Array) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/** Sum of the uncompressed sizes declared in a zip's central directory (guards against zip bombs before unpacking). */
export function zipUncompressedSize(b: Uint8Array): number | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const entries = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (p + 46 > b.length || v.getUint32(p, true) !== 0x02014b50) return null;
    total += v.getUint32(p + 24, true);
    p += 46 + v.getUint16(p + 28, true) + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return total;
}

/** Text of one worksheet cell: formulas yield their cached result, dates become ISO dates, rich text is flattened. */
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && "result" in v && v.result instanceof Date) return v.result.toISOString().slice(0, 10);
  try {
    return cell.text ?? "";
  } catch {
    return "";
  }
}

export async function readRows(bytes: Uint8Array, limits: { maxFileBytes: number; maxUncompressedBytes: number; maxRows: number }): Promise<{ rows: string[][]; format: "csv" | "xlsx" }> {
  if (bytes.length === 0) throw new ImportFileError("file_empty");
  if (bytes.length > limits.maxFileBytes) throw new ImportFileError("file_too_large");
  if (isZip(bytes)) {
    const size = zipUncompressedSize(bytes);
    if (size === null) throw new ImportFileError("xlsx_unreadable");
    if (size > limits.maxUncompressedBytes) throw new ImportFileError("xlsx_too_large");
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    } catch {
      throw new ImportFileError("xlsx_unreadable");
    }
    const ws = wb.worksheets.find((w) => w.rowCount > 0);
    if (!ws) throw new ImportFileError("file_empty");
    if (ws.rowCount > limits.maxRows + 1000) throw new ImportFileError("too_many_rows"); // blank formatted rows are tolerated up to a margin
    const width = ws.columnCount;
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c)));
      if (cells.some((x) => x.trim() !== "")) rows.push(cells);
    });
    return { rows, format: "xlsx" };
  }
  try {
    return { rows: parseCsv(decodeText(bytes)), format: "csv" };
  } catch (e) {
    if (e instanceof CsvError) throw new ImportFileError(e.code);
    throw e;
  }
}

export async function toXlsx(header: string[], rows: (string | number | null)[][] = [], sheetName = "People"): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(header.map((h) => neutralise(h)));
  for (const r of rows) ws.addRow(r.map((c) => (c === null ? "" : typeof c === "number" ? c : neutralise(String(c)))));
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((col) => { col.width = 24; });
  // Formatting as text keeps ids such as 00123 intact when the file is edited and saved again.
  ws.columns.forEach((col) => { col.numFmt = "@"; });
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

export { toCsv };
