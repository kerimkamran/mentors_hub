import { audit } from "@/lib/audit";
import { hasFreshStepUp } from "@/lib/auth/core";
import { withOrg, type Tx } from "@/lib/db";
import { authorize, NotFoundError, type Actor } from "@/lib/permissions";
import { loadRecipient, recipientActor } from "@/domain/notifications/recipient";
import { StepUpRequired } from "@/domain/roles";
import { getBulkAction } from "./registry";
import type { BulkAction, BulkPreview, BulkResult, PreviewRow, RowVerdict } from "./types";

export const MAX_BULK_ROWS = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class BulkRequestInvalid extends Error {
  constructor(readonly code: "empty" | "too_many" | "bad_id") {
    super(code);
  }
}

function cleanIds(ids: string[]): string[] {
  const unique = [...new Set(ids.map((s) => s.trim()))];
  if (unique.length === 0) throw new BulkRequestInvalid("empty");
  if (unique.length > MAX_BULK_ROWS) throw new BulkRequestInvalid("too_many");
  if (unique.some((i) => !UUID.test(i))) throw new BulkRequestInvalid("bad_id");
  return unique;
}

/** One row, one savepoint-free transaction: a denial or error in a row never affects the others. NotFound => "not_found". */
async function verdictFor(actor: Actor, action: BulkAction, id: string, contextId: string | null): Promise<RowVerdict> {
  try {
    return await withOrg(actor.organisationId, (tx) => action.evaluate({ tx, actor, id, contextId }));
  } catch (e) {
    if (e instanceof NotFoundError) return { kind: "skip", reason: "not_found" };
    return { kind: "skip", reason: "error" };
  }
}

const toRow = (id: string, v: RowVerdict): PreviewRow => ({ id, label: v.label ?? null, outcome: v.kind, reason: v.kind === "skip" ? v.reason : null });

/** Preview: what will change and what will be skipped, with the reason for each skip (AC-ADM-15.1). Changes nothing. */
export async function previewBulk(actor: Actor, action: BulkAction, rawIds: string[], contextId: string | null = null): Promise<BulkPreview> {
  authorize(actor, "bulk.run");
  const ids = cleanIds(rawIds);
  const rows: PreviewRow[] = [];
  for (const id of ids) rows.push(toRow(id, await verdictFor(actor, action, id, contextId)));
  const willChange = rows.filter((r) => r.outcome === "change").length;
  return { total: rows.length, willChange, skipped: rows.length - willChange, rows };
}

async function applyRows(actor: Actor, action: BulkAction, ids: string[], contextId: string | null): Promise<PreviewRow[]> {
  const out: PreviewRow[] = [];
  for (const id of ids) {
    // Re-check at run time: a row the actor may not act on is skipped as "not found" even if the preview listed it (AC-ADM-15.3).
    const v = await verdictFor(actor, action, id, contextId);
    if (v.kind === "skip") {
      out.push(toRow(id, v));
      continue;
    }
    try {
      await withOrg(actor.organisationId, (tx) => action.apply({ tx, actor, id, contextId }));
      out.push({ id, label: v.label ?? null, outcome: "change", reason: null });
    } catch (e) {
      out.push({ id, label: v.label ?? null, outcome: "skip", reason: e instanceof NotFoundError ? "not_found" : "failed" });
    }
  }
  return out;
}

async function insertBatch(tx: Tx, actor: Actor, action: BulkAction, ids: string[], contextId: string | null, status: "pending_approval" | "done"): Promise<string> {
  const b = await tx.query<{ id: string }>(
    "INSERT INTO bulk_batch (organisation_id, action_code, context_id, status, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [actor.organisationId, action.code, contextId, status, actor.membershipId],
  );
  const batchId = b.rows[0]!.id;
  for (const id of ids) await tx.query("INSERT INTO bulk_batch_item (batch_id, object_id, organisation_id) VALUES ($1, $2, $3)", [batchId, id, actor.organisationId]);
  return batchId;
}

async function finish(actor: Actor, batchId: string, rows: PreviewRow[], approvedBy: string | null): Promise<BulkResult> {
  const done = rows.filter((r) => r.outcome === "change").length;
  const failed = rows.filter((r) => r.reason === "failed").length;
  const skipped = rows.length - done - failed;
  await withOrg(actor.organisationId, async (tx) => {
    for (const r of rows)
      await tx.query("UPDATE bulk_batch_item SET outcome = $3, reason_code = $4 WHERE batch_id = $1 AND object_id = $2", [
        batchId, r.id, r.outcome === "change" ? "done" : r.reason === "failed" ? "failed" : "skipped", r.reason,
      ]);
    await tx.query(
      "UPDATE bulk_batch SET status = 'done', approved_by = $2, done_count = $3, skipped_count = $4, failed_count = $5, finished_at = now() WHERE id = $1",
      [batchId, approvedBy, done, skipped, failed],
    );
    // ONE audit entry for the whole batch; the ids are in bulk_batch_item (AC-ADM-15.2).
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "bulk.run", objectType: "bulk_batch", objectId: batchId });
  });
  return { status: "done", batchId, done, skipped, failed, rows };
}

/**
 * Confirm: runs the action for the rows that are still allowed and would still change, then records one batch
 * (AC-ADM-15.2). A four-eyes action is only stored as pending and does NOT run (AC-ADM-15.4).
 */
export async function runBulk(actor: Actor, action: BulkAction, rawIds: string[], contextId: string | null = null): Promise<BulkResult> {
  authorize(actor, "bulk.run");
  const ids = cleanIds(rawIds);
  if (action.fourEyes) {
    const batchId = await withOrg(actor.organisationId, async (tx) => {
      const id = await insertBatch(tx, actor, action, ids, contextId, "pending_approval");
      await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "bulk.request", objectType: "bulk_batch", objectId: id });
      return id;
    });
    return { status: "pending_approval", batchId, done: 0, skipped: 0, failed: 0, rows: [] };
  }
  const batchId = await withOrg(actor.organisationId, (tx) => insertBatch(tx, actor, action, ids, contextId, "done"));
  const rows = await applyRows(actor, action, ids, contextId);
  return finish(actor, batchId, rows, null);
}

/**
 * A DIFFERENT org admin, with a fresh authenticator code, approves a pending four-eyes batch; then it runs under the
 * requester's own authority row by row. Self-approval is refused here and by a CHECK in the database.
 */
export async function approveBulk(actor: Actor, batchId: string, now = new Date()): Promise<BulkResult> {
  authorize(actor, "bulk.approve");
  if (!hasFreshStepUp(actor, now)) throw new StepUpRequired();
  const b = await withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ action_code: string; context_id: string | null; status: string; created_by: string }>(
      "SELECT action_code, context_id, status, created_by FROM bulk_batch WHERE id = $1 FOR UPDATE",
      [batchId],
    );
    const row = r.rows[0];
    if (!row || row.status !== "pending_approval" || row.created_by === actor.membershipId) throw new NotFoundError();
    const items = await tx.query<{ object_id: string }>("SELECT object_id FROM bulk_batch_item WHERE batch_id = $1 ORDER BY object_id", [batchId]);
    const requester = await loadRecipient(tx, row.created_by);
    if (!requester) throw new NotFoundError();
    return { ...row, ids: items.rows.map((x) => x.object_id), requester: recipientActor(actor.organisationId, requester) };
  });
  const action = getBulkAction(b.action_code);
  if (!action) throw new NotFoundError();
  const rows = await applyRows(b.requester, action, b.ids, b.context_id);
  return finish(actor, batchId, rows, actor.membershipId);
}

export async function rejectBulk(actor: Actor, batchId: string): Promise<void> {
  authorize(actor, "bulk.approve");
  await withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ status: string; created_by: string }>("SELECT status, created_by FROM bulk_batch WHERE id = $1 FOR UPDATE", [batchId]);
    const row = r.rows[0];
    if (!row || row.status !== "pending_approval") throw new NotFoundError();
    await tx.query("UPDATE bulk_batch SET status = 'rejected', finished_at = now() WHERE id = $1", [batchId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "bulk.reject", objectType: "bulk_batch", objectId: batchId });
  });
}
