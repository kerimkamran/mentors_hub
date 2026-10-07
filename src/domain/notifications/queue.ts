import type { Tx } from "@/lib/db";

/**
 * Transactional job enqueue: the job exists only if the caller's transaction commits (an outbox), and a `job_run`
 * summary row is written beside it so the admin job view can count queued work (US-ADM-05). The payload carries the
 * organisation id plus ids/codes only (INV-3): never an address, text or token.
 */
export interface EnqueueOpts {
  organisationId: string;
  task: string;
  payload?: Record<string, string | number | boolean | null>;
  runAt?: Date;
  /** Replaces an existing not-yet-run job with the same key (reminders, cancel/replace). */
  jobKey?: string;
  maxAttempts?: number;
}

export async function enqueueInTx(tx: Tx, o: EnqueueOpts): Promise<string> {
  const payload = { ...(o.payload ?? {}), organisationId: o.organisationId };
  const r = await tx.query<{ id: string }>(
    `SELECT (graphile_worker.add_job($1::text, $2::json, run_at => $3::timestamptz, max_attempts => $4::int, job_key => $5::text)).id AS id`,
    [o.task, JSON.stringify(payload), o.runAt ?? null, o.maxAttempts ?? 5, o.jobKey ?? null],
  );
  const id = r.rows[0]!.id;
  await tx.query(
    `INSERT INTO job_run (organisation_id, graphile_job_id, queue, status, attempts, max_attempts)
     VALUES ($1, $2, $3, 'queued', 0, $4)
     ON CONFLICT (organisation_id, graphile_job_id)
     DO UPDATE SET status = 'queued', attempts = 0, last_error_code = NULL, started_at = NULL, finished_at = NULL`,
    [o.organisationId, id, o.task, o.maxAttempts ?? 5],
  );
  return id;
}

/** Removes a not-yet-run job by key (cancel a reminder). Returns whether a job was removed. */
export async function cancelJob(tx: Tx, jobKey: string, organisationId: string): Promise<boolean> {
  const r = await tx.query<{ id: string | null }>("SELECT (graphile_worker.remove_job($1::text)).id AS id", [jobKey]);
  const id = r.rows[0]?.id;
  if (!id) return false;
  await tx.query("DELETE FROM job_run WHERE organisation_id = $1 AND graphile_job_id = $2", [organisationId, id]);
  return true;
}
