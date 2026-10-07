import { audit } from "@/lib/audit";
import { withGlobal, withOrg } from "@/lib/db";
import { importSettings } from "./settings";

/**
 * Retention of raw import rows (FR-IMP-010, C-104): rows older than the retention period are deleted; the run's counts, its
 * state and the resulting person records stay. Idempotent. One organisation per call, through the tenant-scoped client.
 */
export async function purgeRawImportRows(organisationId: string, now = new Date()): Promise<number> {
  const { rawRowRetentionDays } = await importSettings(organisationId);
  const cutoff = new Date(now.getTime() - rawRowRetentionDays * 86_400_000);
  return withOrg(organisationId, async (tx) => {
    const old = await tx.query<{ id: string }>("SELECT id FROM import_run WHERE rows_purged_at IS NULL AND created_at < $1 FOR UPDATE", [cutoff]);
    for (const r of old.rows) {
      await tx.query("DELETE FROM import_row WHERE run_id = $1", [r.id]);
      await tx.query("UPDATE import_run SET rows_purged_at = $2 WHERE id = $1", [r.id, now]);
      await audit(tx, { organisationId, actorId: null, action: "import.purge", objectType: "import_run", objectId: r.id });
    }
    return old.rows.length;
  });
}

/** All organisations (the organisation list is a global table); returns the number of runs purged. */
export async function purgeRawImportRowsEverywhere(now = new Date()): Promise<number> {
  const orgs = await withGlobal((tx) => tx.query<{ id: string }>("SELECT id FROM organisation"));
  let n = 0;
  for (const o of orgs.rows) n += await purgeRawImportRows(o.id, now);
  return n;
}
