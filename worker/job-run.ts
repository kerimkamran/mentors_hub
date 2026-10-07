import type { Task } from "graphile-worker";
import { withOrg } from "../src/lib/db";

/**
 * Wraps a tenant task so a summary row (queue, status, attempts, error CODE, times) is kept in job_run for the admin
 * job view (US-ADM-05). The payload and the error message are never copied: only the task name and a short code.
 * A task is "tenant" when its payload carries `organisationId`; other tasks pass through untouched.
 * Recording problems never break the job itself.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An error whose message IS the code (graphile-worker stores the message in its own table: keep it free of content). */
export class JobError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function errorCodeOf(e: unknown): string {
  const raw = e instanceof JobError ? e.code : typeof (e as { code?: unknown })?.code === "string" ? String((e as { code: string }).code) : "error";
  let c = raw.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
  if (!/^[a-z]/.test(c)) c = `e_${c}`.slice(0, 40);
  return c.length >= 2 ? c : "error";
}

interface JobInfo {
  id: string;
  task_identifier: string;
  attempts: number;
  max_attempts: number;
}

async function record(organisationId: string, job: JobInfo, status: "running" | "succeeded" | "failed" | "queued", code: string | null) {
  try {
    await withOrg(organisationId, (tx) =>
      tx.query(
        `INSERT INTO job_run (organisation_id, graphile_job_id, queue, status, attempts, max_attempts, last_error_code, started_at, finished_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), CASE WHEN $4 IN ('succeeded', 'failed') THEN now() END)
         ON CONFLICT (organisation_id, graphile_job_id) DO UPDATE SET
           status = EXCLUDED.status, attempts = EXCLUDED.attempts, max_attempts = EXCLUDED.max_attempts,
           last_error_code = CASE WHEN EXCLUDED.status = 'succeeded' THEN NULL ELSE COALESCE(EXCLUDED.last_error_code, job_run.last_error_code) END,
           started_at = CASE WHEN EXCLUDED.status = 'running' THEN now() ELSE COALESCE(job_run.started_at, EXCLUDED.started_at) END,
           finished_at = EXCLUDED.finished_at`,
        [organisationId, job.id, job.task_identifier, status, job.attempts, job.max_attempts, code],
      ),
    );
  } catch {
    // never let bookkeeping fail a job
  }
}

export function withJobRun(task: Task): Task {
  return async (payload, helpers) => {
    const org = (payload as { organisationId?: unknown } | null)?.organisationId;
    const orgId = typeof org === "string" && UUID.test(org) ? org : null;
    const job = helpers.job as unknown as JobInfo;
    if (orgId) await record(orgId, job, "running", null);
    try {
      await task(payload, helpers);
    } catch (e) {
      if (orgId) await record(orgId, job, job.attempts >= job.max_attempts ? "failed" : "queued", errorCodeOf(e));
      throw e;
    }
    if (orgId) await record(orgId, job, "succeeded", null);
  };
}
