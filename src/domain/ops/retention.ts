import { withGlobal, withOrg } from "@/lib/db";
import { retentionDays } from "@/domain/notifications/settings";

/**
 * Operational history is short-lived: delivery log rows (status and error code only) after C-161 days, job run
 * summaries after C-162 days. Runs per organisation under the normal tenant context; used by the ops.purge worker task.
 */
export async function purgeOperationalHistory(now: Date = new Date()): Promise<{ deliveries: number; jobs: number }> {
  const days = retentionDays();
  const orgs = await withGlobal((tx) => tx.query<{ id: string }>("SELECT id FROM organisation"));
  let deliveries = 0;
  let jobs = 0;
  for (const o of orgs.rows) {
    await withOrg(o.id, async (tx) => {
      const d = await tx.query(
        "DELETE FROM delivery_attempt WHERE COALESCE(attempted_at, queued_at) < $1::timestamptz - make_interval(days => $2)",
        [now, days.deliveryLog],
      );
      const j = await tx.query(
        "DELETE FROM job_run WHERE COALESCE(finished_at, created_at) < $1::timestamptz - make_interval(days => $2)",
        [now, days.jobHistory],
      );
      deliveries += d.rowCount ?? 0;
      jobs += j.rowCount ?? 0;
    });
  }
  return { deliveries, jobs };
}
