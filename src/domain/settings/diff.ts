import { flatten } from "./registry";

export interface DiffRow { path: string; from: unknown; to: unknown }

/** Every changed value, old and new; unchanged values are omitted (AC-PRG-04.2). */
export function diffValues(a: unknown, b: unknown): DiffRow[] {
  const fa = flatten(a), fb = flatten(b);
  const paths = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].sort();
  return paths.filter((p) => JSON.stringify(fa[p]) !== JSON.stringify(fb[p])).map((p) => ({ path: p, from: fa[p], to: fb[p] }));
}

/** Values that differ from the starting defaults, listed before "Restore defaults" is confirmed (AC-PRG-04.4). */
export const differsFromDefaults = (current: unknown, defaults: unknown): DiffRow[] => diffValues(current, defaults);
