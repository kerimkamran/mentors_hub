import type { Task } from "graphile-worker";

/** Smoke-test task: proves the worker can run jobs as the least-privilege app role. Touches no tenant data. */
export const healthPing: Task = async (_payload, helpers) => {
  helpers.logger.info("health.ping");
};
