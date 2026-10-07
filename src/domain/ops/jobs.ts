import { audit } from "@/lib/audit";
import { withGlobal, withOrg } from "@/lib/db";
import { authorize, can, type Actor } from "@/lib/permissions";

export const JOB_STATUSES = ["queued", "running", "succeeded", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface QueueCounts {
  queue: string;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
}

export interface JobRow {
  id: string; // job_run id (what Retry takes)
  jobId: string; // the worker's job number shown to the admin
  queue: string;
  status: JobStatus;
  attempts: number;
  lastErrorCode: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/** Counts and a list. Rows hold queue, status, attempts, error code and times: never a payload or an address (AC-ADM-05.3). */
export async function listJobs(actor: Actor, limit = 100): Promise<{ queues: QueueCounts[]; jobs: JobRow[] }> {
  authorize(actor, "ops.jobs.view");
  return withOrg(actor.organisationId, async (tx) => {
    const c = await tx.query<{ queue: string; status: JobStatus; n: number }>("SELECT queue, status, count(*)::int AS n FROM job_run GROUP BY queue, status");
    const byQueue = new Map<string, QueueCounts>();
    for (const r of c.rows) {
      const q = byQueue.get(r.queue) ?? { queue: r.queue, queued: 0, running: 0, succeeded: 0, failed: 0 };
      q[r.status] = r.n;
      byQueue.set(r.queue, q);
    }
    const j = await tx.query<{
      id: string; graphile_job_id: string; queue: string; status: JobStatus; attempts: number; last_error_code: string | null;
      created_at: Date; started_at: Date | null; finished_at: Date | null;
    }>(
      `SELECT id, graphile_job_id, queue, status, attempts, last_error_code, created_at, started_at, finished_at
         FROM job_run ORDER BY created_at DESC, id LIMIT $1`,
      [Math.min(Math.max(limit, 1), 500)],
    );
    return {
      queues: [...byQueue.values()].sort((a, b) => a.queue.localeCompare(b.queue)),
      jobs: j.rows.map((r) => ({
        id: r.id, jobId: r.graphile_job_id, queue: r.queue, status: r.status, attempts: r.attempts, lastErrorCode: r.last_error_code,
        createdAt: r.created_at, startedAt: r.started_at, finishedAt: r.finished_at,
      })),
    };
  });
}

export class NotRetryable extends Error {
  constructor(readonly code: "not_failed" | "job_gone") {
    super(code);
  }
}

/**
 * Re-queues a FAILED job once per click. The row is locked, so a double click cannot queue it twice; a job that is not
 * failed (already succeeded, queued again, running) is refused (AC-ADM-05.2). Audited by id.
 */
export async function retryJob(actor: Actor, jobRunId: string): Promise<void> {
  authorize(actor, "ops.jobs.retry");
  await withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ graphile_job_id: string; status: JobStatus }>("SELECT graphile_job_id, status FROM job_run WHERE id = $1 FOR UPDATE", [jobRunId]);
    const row = r.rows[0];
    if (!row) throw new NotRetryable("job_gone"); // another organisation's job looks exactly like a missing one
    if (row.status !== "failed") throw new NotRetryable("not_failed");
    const re = await tx.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM graphile_worker.reschedule_jobs(ARRAY[$1::bigint], run_at => now(), attempts => 0)",
      [row.graphile_job_id],
    );
    if (!re.rows[0] || re.rows[0].n === 0) throw new NotRetryable("job_gone");
    await tx.query("UPDATE job_run SET status = 'queued', attempts = 0, retried_at = now(), finished_at = NULL WHERE id = $1", [jobRunId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "ops.job.retry", objectType: "job_run", objectId: jobRunId });
  });
}

export interface PlatformQueueHealth {
  queue: string;
  pending: number;
  running: number;
  failed: number;
}

/**
 * Platform-wide queue health for a platform admin: counts per queue across the platform, nothing about any tenant's
 * jobs (AC-ADM-05.5). Reads the worker's own table through the global context and exposes only counts.
 */
export async function platformJobHealth(actor: Actor): Promise<PlatformQueueHealth[]> {
  authorize(actor, "ops.jobs.platform_health");
  const r = await withGlobal((tx) =>
    tx.query<{ queue: string; pending: number; running: number; failed: number }>(
      `SELECT task_identifier AS queue,
              count(*) FILTER (WHERE locked_at IS NULL AND attempts < max_attempts)::int AS pending,
              count(*) FILTER (WHERE locked_at IS NOT NULL)::int AS running,
              count(*) FILTER (WHERE locked_at IS NULL AND attempts >= max_attempts)::int AS failed
         FROM graphile_worker.jobs GROUP BY task_identifier ORDER BY 1`,
    ),
  );
  return r.rows;
}

/** Which view the actor gets on the jobs page: the organisation's jobs, or platform health, or none (not found). */
export function jobsView(actor: Actor): "org" | "platform" | null {
  if (can(actor, "ops.jobs.view")) return "org";
  if (can(actor, "ops.jobs.platform_health")) return "platform";
  return null;
}
