/**
 * Spreadsheet cell hygiene (FR-IMP-008). A cell that starts with = + - @ (or a tab or carriage return) can be run as a
 * formula by Excel, LibreOffice or Sheets. We neutralise such text on import AND on every exported file by prefixing an
 * apostrophe, which spreadsheets show as plain text. Pure and framework-free.
 */
const TRIGGER = /^[=+\-@\t\r]/;

export function needsNeutralising(value: string): boolean {
  if (TRIGGER.test(value)) return true;
  // Leading spaces/line breaks before a trigger are stripped by some tools, so treat them the same.
  return TRIGGER.test(value.replace(/^[ \n ]+/, ""));
}

export function neutralise(value: string): string {
  return needsNeutralising(value) ? `'${value}` : value;
}

/** Control characters other than tab, CR and LF are removed; then trimmed and neutralised. Used for every imported cell. */
export function cleanCell(raw: unknown): string {
  const s = raw === null || raw === undefined ? "" : String(raw);
  const stripped = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return neutralise(stripped.trim());
}

/** One CSV field: neutralised first, then quoted when needed (RFC 4180). */
export function csvField(value: string | number | null | undefined): string {
  const s = neutralise(value === null || value === undefined ? "" : String(value));
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Whole CSV document with a UTF-8 byte-order mark (Excel then reads Azerbaijani and Russian letters correctly). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}
