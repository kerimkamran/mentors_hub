/**
 * Background worker (graphile-worker). Runs as the app role: tenant work must set the
 * organisation context exactly like the web app (INV-1.5). Slice S3 adds notification jobs.
 */
import { run } from "graphile-worker";
import { env, EnvError } from "../src/lib/env";
import { healthPing } from "./tasks/health-ping";
import { importPurge } from "./tasks/import-purge";
import { mailSignIn } from "./tasks/mail-signin";
import { withJobRun } from "./job-run";
import { announcementNotify } from "./tasks/announcement-notify";
import { mailSend } from "./tasks/mail-send";
import { notifyFire } from "./tasks/notify-fire";
import { opsPurge } from "./tasks/ops-purge";

/** Recurring jobs (graphile-worker crontab): S2 raw import rows daily 03:10 UTC (C-104); S3 operational history daily 03:17 UTC (C-161, C-162). */
export const crontab = ["10 3 * * * import.purge", "17 3 * * * ops.purge"].join("\n");

export const taskList = {
  "health.ping": healthPing,
  "mail.signin": mailSignIn,
  "import.purge": importPurge,
  // S3 notifications and operations: wrapped so job_run keeps a summary (queue, status, attempts, error code) per job.
  "mail.send": withJobRun(mailSend),
  "notify.fire": withJobRun(notifyFire),
  "announcement.notify": withJobRun(announcementNotify),
  "ops.purge": opsPurge,
};

async function main() {
  let url: string;
  try {
    url = env().DATABASE_URL;
  } catch (e) {
    if (e instanceof EnvError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
  const runner = await run({ connectionString: url, concurrency: 5, taskList, crontab });
  const stop = async () => {
    await runner.stop();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  await runner.promise;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
