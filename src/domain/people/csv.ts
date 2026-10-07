/** Small RFC 4180 CSV reader: quoted fields, doubled quotes, embedded line breaks, BOM, and `,` `;` or tab delimiters. */
export class CsvError extends Error {
  constructor(readonly code: "csv_malformed" | "file_encoding") {
    super(code);
  }
}

export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    throw new CsvError("file_encoding");
  }
}

/** Picks the delimiter that occurs most often in the first line outside quotes (Excel in az/ru locales writes `;`). */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && ch in counts) counts[ch]!++;
  }
  if (counts[";"]! > counts[","]! && counts[";"]! >= counts["\t"]!) return ";";
  if (counts["\t"]! > counts[","]! && counts["\t"]! > counts[";"]!) return "\t";
  return ",";
}

export function parseCsv(input: string): string[][] {
  let text = input.replace(/^﻿/, "");
  if (/^sep=.\r?\n/i.test(text)) text = text.replace(/^sep=.\r?\n/i, ""); // Excel's delimiter hint line
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;
  const endField = () => { row.push(field); field = ""; fieldWasQuoted = false; };
  const endRow = () => {
    endField();
    if (row.some((c) => c.trim() !== "")) rows.push(row); // skip blank lines
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "" && !fieldWasQuoted) {
      inQuotes = true;
      fieldWasQuoted = true;
    } else if (ch === delim) endField();
    else if (ch === "\r") { if (text[i + 1] === "\n") i++; endRow(); }
    else if (ch === "\n") endRow();
    else if (fieldWasQuoted && !inQuotes) throw new CsvError("csv_malformed"); // text after a closing quote
    else field += ch;
  }
  if (inQuotes) throw new CsvError("csv_malformed");
  if (field !== "" || row.length > 0) endRow();
  return rows;
}
