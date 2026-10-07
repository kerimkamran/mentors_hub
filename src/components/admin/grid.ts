/** Pure helpers for the data table: keyboard movement between cells and sorting (AC-ADM-23.2). No React. */

export type NavKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End" | "PageUp" | "PageDown";
export const NAV_KEYS: readonly string[] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"];

export interface Pos {
  row: number;
  col: number;
}

/** Next cell for a navigation key inside a rows x cols grid; stays inside the grid. Ctrl+Home/End are handled by the caller. */
export function gridMove(pos: Pos, key: NavKey, rows: number, cols: number, page = 10): Pos {
  if (rows <= 0 || cols <= 0) return pos;
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max - 1);
  switch (key) {
    case "ArrowUp": return { row: clamp(pos.row - 1, rows), col: pos.col };
    case "ArrowDown": return { row: clamp(pos.row + 1, rows), col: pos.col };
    case "ArrowLeft": return { row: pos.row, col: clamp(pos.col - 1, cols) };
    case "ArrowRight": return { row: pos.row, col: clamp(pos.col + 1, cols) };
    case "Home": return { row: pos.row, col: 0 };
    case "End": return { row: pos.row, col: cols - 1 };
    case "PageUp": return { row: clamp(pos.row - page, rows), col: pos.col };
    case "PageDown": return { row: clamp(pos.row + page, rows), col: pos.col };
  }
}

export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}

/** Click on a header: first ascending, then descending, then back to the original order. */
export function nextSort(current: SortState | null, key: string): SortState | null {
  if (!current || current.key !== key) return { key, dir: "asc" };
  return current.dir === "asc" ? { key, dir: "desc" } : null;
}

/** Stable sort by a column's sort value (numbers numerically, text with locale-aware, accent-insensitive comparison). */
export function sortRows<T extends { sort?: Record<string, string | number> }>(rows: T[], sort: SortState | null, locale = "en"): T[] {
  if (!sort) return rows;
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const idx = rows.map((r, i) => ({ r, i }));
  idx.sort((a, b) => {
    const x = a.r.sort?.[sort.key];
    const y = b.r.sort?.[sort.key];
    let c: number;
    if (x === undefined && y === undefined) c = 0;
    else if (x === undefined) c = 1;
    else if (y === undefined) c = -1;
    else if (typeof x === "number" && typeof y === "number") c = x - y;
    else c = collator.compare(String(x), String(y));
    return (sort.dir === "asc" ? c : -c) || a.i - b.i;
  });
  return idx.map((x) => x.r);
}

export const ariaSort = (s: SortState | null, key: string): "ascending" | "descending" | "none" =>
  s && s.key === key ? (s.dir === "asc" ? "ascending" : "descending") : "none";
