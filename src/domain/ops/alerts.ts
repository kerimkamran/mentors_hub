import { withOrg } from "@/lib/db";
import { can, type Actor } from "@/lib/permissions";
import { bounceStatus } from "./email-log";

/**
 * Operational alerts for the alert centre (SCR-19, built in the dashboard slice): ids, counts and links only
 * (AC-ADM-09.4). They are computed from current state, so they disappear on their own when the condition clears
 * (AC-ADM-09.2). Only organisation admins receive operational alerts.
 */
export interface OpsAlert {
  code: "ops.bounce_spike" | "ops.jobs_failed" | "ops.email_failed";
  count: number;
  href: string;
}

export async function opsAlerts(actor: Actor, now: Date = new Date()): Promise<OpsAlert[]> {
  if (!can(actor, "ops.jobs.view")) return [];
  return withOrg(actor.organisationId, async (tx) => {
    const out: OpsAlert[] = [];
    const b = await bounceStatus(tx, actor.organisationId, now);
    if (b.alert) out.push({ code: "ops.bounce_spike", count: b.bounced, href: "/admin/ops/email" });
    const j = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM job_run WHERE status = 'failed'");
    if (j.rows[0]!.n > 0) out.push({ code: "ops.jobs_failed", count: j.rows[0]!.n, href: "/admin/ops/jobs" });
    const e = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM delivery_attempt d WHERE d.status = 'failed'
          AND NOT EXISTS (SELECT 1 FROM delivery_attempt d2 WHERE d2.notification_id = d.notification_id AND d2.attempt_no > d.attempt_no)`,
    );
    if (e.rows[0]!.n > 0) out.push({ code: "ops.email_failed", count: e.rows[0]!.n, href: "/admin/ops/email" });
    return out;
  });
}
