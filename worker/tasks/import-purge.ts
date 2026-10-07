import type { Task } from "graphile-worker";
import { purgeRawImportRowsEverywhere } from "../../src/domain/people/retention";

/** Daily retention job: deletes raw import rows older than C-104 (30 days). Logs a count only, never row content. */
export const importPurge: Task = async (_payload, helpers) => {
  const n = await purgeRawImportRowsEverywhere();
  helpers.logger.info(`import.purge runs=${n}`);
};
