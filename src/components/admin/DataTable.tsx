"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { saveDensity } from "@/app/settings/appearance/actions";
import { ariaSort, gridMove, NAV_KEYS, nextSort, sortRows, type NavKey, type Pos, type SortState } from "./grid";

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  /** Hidden until the person turns it on in the column chooser. */
  defaultHidden?: boolean;
}
export interface TableRow {
  id: string;
  cells: Record<string, ReactNode>;
  /** Values used when sorting a column (cells may be rich elements). */
  sort?: Record<string, string | number>;
}
export interface TableLabels {
  caption: string;
  sortBy: string; // "Sort by {column}" with {column} replaced here
  columns: string;
  density: string;
  dense: string;
  comfortable: string;
  rowCount: string; // e.g. "12 rows"
  empty: string;
  selectRow: string;
  selectAll: string;
  selectedCount: string; // announced politely, e.g. "3 selected"
  hint: string; // keyboard hint
}

/**
 * Accessible data table (A3, AC-ADM-23.2/23.3/23.4): sortable columns, column chooser, comfortable/dense toggle that is
 * remembered per person, arrow-key movement between cells, optional row selection, and a card layout on narrow screens
 * (CSS in globals.css). Header cells carry scope="col"; sort state is exposed with aria-sort.
 */
export function DataTable({ columns, rows, labels, locale = "en", selectName, initialDensity = "comfortable" }: {
  columns: TableColumn[];
  rows: TableRow[];
  labels: TableLabels;
  locale?: string;
  /** When set, a checkbox column submits the selected row ids under this form field name. */
  selectName?: string;
  initialDensity?: "comfortable" | "dense";
}) {
  const uid = useId();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)));
  const [sort, setSort] = useState<SortState | null>(null);
  const [density, setDensity] = useState(initialDensity);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pos, setPos] = useState<Pos>({ row: 0, col: 0 });
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const shown = columns.filter((c) => !hidden.has(c.key));
  const sorted = useMemo(() => sortRows(rows, sort, locale), [rows, sort, locale]);
  const offset = selectName ? 1 : 0; // the checkbox column is column 0 of the grid
  const gridCols = shown.length + offset;

  function focusCell(p: Pos) {
    setPos(p);
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-r="${p.row}"][data-c="${p.col}"]`);
    el?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableSectionElement>) {
    if (!NAV_KEYS.includes(e.key)) return;
    const target = e.target as HTMLElement;
    const cell = target.closest<HTMLElement>("[data-cell]");
    if (!cell) return;
    // Let form controls inside a cell keep their own arrow-key behaviour (text, selects, radios).
    if (target !== cell && target.matches("input:not([type=checkbox]), select, textarea")) return;
    const here: Pos = { row: Number(cell.dataset.r), col: Number(cell.dataset.c) };
    e.preventDefault();
    focusCell(gridMove(here, e.key as NavKey, sorted.length, gridCols));
  }

  function onActivate(e: KeyboardEvent<HTMLElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter") {
      const inner = e.currentTarget.querySelector<HTMLElement>("a, button, input");
      if (inner) {
        e.preventDefault();
        inner.click();
      }
    } else if (e.key === " " && selectName) {
      e.preventDefault();
      const id = e.currentTarget.closest("tr")?.dataset.id;
      if (id) toggle(id);
    }
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  async function chooseDensity(d: "comfortable" | "dense") {
    setDensity(d);
    try {
      await saveDensity(d);
    } catch {
      /* the choice still applies for this page; saving is best-effort */
    }
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const cellProps = (r: number, c: number) => ({
    "data-cell": "",
    "data-r": r,
    "data-c": c,
    tabIndex: pos.row === r && pos.col === c ? 0 : -1,
    onFocus: () => setPos({ row: r, col: c }),
    onKeyDown: onActivate,
  });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <p className="text-sm" role="status">{labels.rowCount}{selectName && selected.size > 0 ? ` · ${labels.selectedCount.replace("{n}", String(selected.size))}` : ""}</p>
        <details className="relative">
          <summary className="min-h-11 cursor-pointer rounded-md border border-[var(--border)] px-3 py-2">{labels.columns}</summary>
          <fieldset className="absolute z-10 mt-1 min-w-48 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
            <legend className="sr-only">{labels.columns}</legend>
            {columns.map((c) => (
              <label key={c.key} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={!hidden.has(c.key)}
                  disabled={!hidden.has(c.key) && shown.length === 1}
                  onChange={() => setHidden((h) => { const n = new Set(h); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })}
                />
                {c.label}
              </label>
            ))}
          </fieldset>
        </details>
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">{labels.density}</legend>
          {(["comfortable", "dense"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={density === d} onClick={() => void chooseDensity(d)}
              className="min-h-11 rounded-md border border-[var(--border)] px-3 py-2 aria-pressed:bg-[var(--accent)] aria-pressed:text-[var(--accent-fg)]">
              {d === "dense" ? labels.dense : labels.comfortable}
            </button>
          ))}
        </fieldset>
      </div>
      <p id={`${uid}-hint`} className="sr-only">{labels.hint}</p>
      <div className="mh-table-wrap">
        <table className="mh-table" aria-describedby={`${uid}-hint`} aria-rowcount={sorted.length + 1}>
          <caption className="sr-only">{labels.caption}</caption>
          <thead>
            <tr>
              {selectName && (
                <th scope="col">
                  <input type="checkbox" aria-label={labels.selectAll} checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} />
                </th>
              )}
              {shown.map((c) => (
                <th key={c.key} scope="col" aria-sort={c.sortable ? ariaSort(sort, c.key) : undefined}>
                  {c.sortable ? (
                    <button type="button" className="min-h-11 font-semibold underline-offset-2 hover:underline" onClick={() => setSort((s) => nextSort(s, c.key))}
                      aria-label={labels.sortBy.replace("{column}", c.label)}>
                      {c.label}
                      <span aria-hidden> {sort?.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={bodyRef} onKeyDown={onKeyDown}>
            {sorted.length === 0 && (
              <tr><td colSpan={gridCols || 1}>{labels.empty}</td></tr>
            )}
            {sorted.map((row, r) => (
              <tr key={row.id} data-id={row.id} aria-selected={selectName ? selected.has(row.id) : undefined}>
                {selectName && (
                  <td {...cellProps(r, 0)} data-label="">
                    <input type="checkbox" name={selectName} value={row.id} aria-label={labels.selectRow} checked={selected.has(row.id)} onChange={() => toggle(row.id)} tabIndex={-1} />
                  </td>
                )}
                {shown.map((c, ci) => (
                  <td key={c.key} {...cellProps(r, ci + offset)} data-label={c.label}>{row.cells[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
