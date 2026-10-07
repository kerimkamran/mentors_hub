import type { Task } from "graphile-worker";
import { purgeOperationalHistory } from "../../src/domain/ops/retention";

/** ops.purge (daily, cron): deletes delivery_attempt rows older than C-161 and job_run rows older than C-162. */
export const opsPurge: Task = async (_payload, helpers) => {
  const r = await purgeOperationalHistory();
  helpers.logger.info(`ops.purge deliveries=${r.deliveries} jobs=${r.jobs}`);
};
