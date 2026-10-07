import { runOnce, quickAddJob } from "graphile-worker";
import { describe, expect, it } from "vitest";
import { taskList } from "../../worker";
import { APP_URL, connect, OWNER_URL } from "./helpers";

describe("Background worker (S0)", () => {
  it("runs a job as the least-privilege app role", async () => {
    await quickAddJob({ connectionString: APP_URL }, "health.ping", {});
    await runOnce({ connectionString: APP_URL, taskList });
    const c = await connect(OWNER_URL);
    const left = await c.query("SELECT count(*)::int AS n FROM graphile_worker.jobs WHERE task_identifier = 'health.ping'");
    expect(left.rows[0].n).toBe(0); // completed jobs are removed
    await c.end();
  });

  it("the worker's database role cannot read tenant data without a context", async () => {
    const c = await connect(APP_URL);
    const r = await c.query("SELECT count(*)::int AS n FROM audit_log");
    expect(r.rows[0].n).toBe(0);
    await c.end();
  });
});
