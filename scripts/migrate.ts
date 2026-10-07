/**
 * Migration runner (plain SQL, forward-only).
 * - Runs as the OWNER role (MIGRATION_DATABASE_URL), never the app role.
 * - One advisory lock: two deploys cannot migrate at once.
 * - Each file runs in its own transaction; a failure aborts the whole run with a non-zero exit,
 *   so the release does not go live (INV-8, T-INV8-01).
 * - Applied files are checksummed; editing an applied migration fails the run.
 * - Also installs the graphile-worker schema and grants the app role access to it.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runMigrations } from "graphile-worker";
import { applyDerivedEnv } from "../src/lib/derive-env";

const defaultDir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

export async function migrate(
  connectionString: string,
  log: (m: string) => void = console.log,
  dir: string = defaultDir,
) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(727001)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const applied = new Map(
      (await client.query<{ version: string; checksum: string }>("SELECT version, checksum FROM schema_migrations"))
        .rows.map((r) => [r.version, r.checksum]),
    );
    const files = readdirSync(dir).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
    for (const file of files) {
      const sql = readFileSync(join(dir, file), "utf8");
      const sum = createHash("sha256").update(sql).digest("hex");
      const have = applied.get(file);
      if (have) {
        if (have !== sum) throw new Error(`[MIG-002] applied migration ${file} was modified`);
        continue;
      }
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [file, sum]);
        await client.query("COMMIT");
        log(`applied ${file}`);
      } catch (e) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw new Error(`[MIG-001] migration ${file} failed: ${(e as Error).message}`);
      }
    }
    // Background-job schema (graphile-worker), owned by the owner role; app role gets runtime access only.
    await runMigrations({ connectionString });
    await client.query(`
      GRANT USAGE ON SCHEMA graphile_worker TO mh_app;
      GRANT ALL ON ALL TABLES IN SCHEMA graphile_worker TO mh_app;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA graphile_worker TO mh_app;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA graphile_worker TO mh_app;`);
    // graphile-worker enables RLS (no policies) on its own tables; give the least-privilege app role
    // an explicit policy on each so it can enqueue and run jobs WITHOUT BYPASSRLS (INV-1.4).
    // These tables hold job metadata only; tenant data is never read through them.
    await client.query(`
      DO $$
      DECLARE t record;
      BEGIN
        FOR t IN SELECT c.relname FROM pg_class c
                 WHERE c.relnamespace = 'graphile_worker'::regnamespace AND c.relkind = 'r' AND c.relrowsecurity
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS mh_app_jobs ON graphile_worker.%I', t.relname);
          EXECUTE format('CREATE POLICY mh_app_jobs ON graphile_worker.%I TO mh_app USING (true) WITH CHECK (true)', t.relname);
        END LOOP;
      END $$;`);
    log("migrations up to date");
  } finally {
    await client.query("SELECT pg_advisory_unlock(727001)").catch(() => undefined);
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  applyDerivedEnv();
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) {
    console.error("[ENV-001] MIGRATION_DATABASE_URL is required");
    process.exit(1);
  }
  migrate(url).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
