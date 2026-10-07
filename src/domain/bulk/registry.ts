import { ACTIONS } from "./actions";
import type { BulkAction } from "./types";

const byCode = new Map<string, BulkAction>();
for (const a of ACTIONS) {
  if (byCode.has(a.code)) throw new Error(`duplicate bulk action ${a.code}`);
  byCode.set(a.code, a);
}

export const getBulkAction = (code: string): BulkAction | undefined => byCode.get(code);
export const allBulkActions = (): BulkAction[] => [...byCode.values()];

/** For tests: register an action under its code (replaces an earlier registration). Never call from application code. */
export function registerBulkActionForTest(a: BulkAction): void {
  byCode.set(a.code, a);
}
