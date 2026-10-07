import type { Tx } from "@/lib/db";
import type { Actor } from "@/lib/permissions";

/** Why a row is skipped. A code the UI translates (messages ops: bulk.reason.<code>). */
export type SkipReason = string;

export type RowVerdict =
  | { kind: "change"; /** Name shown in the preview (names only, never content). */ label?: string }
  | { kind: "skip"; reason: SkipReason; label?: string };

export interface RowCtx {
  tx: Tx;
  actor: Actor;
  id: string;
  /** Optional target of the action, e.g. the cohort to invite into. */
  contextId: string | null;
}

/**
 * One bulk action (invite, nominate, withdraw, send reminder, erase …). Owned by the slice that owns the data: add a
 * file under src/domain/bulk/actions/ and one line to actions/index.ts (see docs/NOTIFICATIONS.md "Bulk actions").
 */
export interface BulkAction {
  code: string;
  /** Message key (src/messages) for the action's name. */
  labelKey: string;
  /** Bulk erasure and similar: stored pending until a DIFFERENT org admin approves (AC-ADM-15.4). */
  fourEyes?: boolean;
  /**
   * Read-only check of ONE row. Must call authorize(ctx.actor, …) for the row, so a row the actor may not act on throws
   * NotFoundError (the engine reports it as "not found", AC-ADM-15.3). Return `skip` with a reason when nothing would change.
   */
  evaluate: (ctx: RowCtx) => Promise<RowVerdict>;
  /** Performs the change for one row. Runs only after a fresh `evaluate` said "change". */
  apply: (ctx: RowCtx) => Promise<void>;
}

export interface PreviewRow {
  id: string;
  label: string | null;
  outcome: "change" | "skip";
  reason: SkipReason | null;
}

export interface BulkPreview {
  total: number;
  willChange: number;
  skipped: number;
  rows: PreviewRow[];
}

export interface BulkResult {
  status: "done" | "pending_approval";
  batchId: string;
  done: number;
  skipped: number;
  failed: number;
  rows: PreviewRow[];
}
