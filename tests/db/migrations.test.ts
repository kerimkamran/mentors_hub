import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { OWNER_URL, connect, withScratchDb } from "./helpers";

const quiet = () => undefined;

describe("INV-8 · migrations fail closed", () => {
  it("T-INV8-01 · a failing migration aborts the run, rolls back, and records nothing", async () => {
    await withScratchDb(async (url) => {
      const dir = mkdtempSync(join(tmpdir(), "mig-"));
      writeFileSync(join(dir, "0001_ok.sql"), "CREATE TABLE ok_table (id int);");
      writeFileSync(join(dir, "0002_bad.sql"), "CREATE TABLE half (id int); SELECT 1/0;");
      await expect(migrate(url, quiet, dir)).rejects.toThrow(/MIG-001.*0002_bad/);
      const c = await connect(url);
      const half = await c.query("SELECT to_regclass('half') AS t");
      expect(half.rows[0].t).toBeNull();
      const recorded = await c.query("SELECT version FROM schema_migrations ORDER BY version");
      expect(recorded.rows.map((r) => r.version)).toEqual(["0001_ok.sql"]);
      await c.end();
    });
  });

  it("re-running is idempotent and an edited applied migration is refused", async () => {
    await withScratchDb(async (url) => {
      const dir = mkdtempSync(join(tmpdir(), "mig-"));
      writeFileSync(join(dir, "0001_ok.sql"), "CREATE TABLE ok_table (id int);");
      await migrate(url, quiet, dir);
      await migrate(url, quiet, dir);
      writeFileSync(join(dir, "0001_ok.sql"), "CREATE TABLE ok_table (id int, extra int);");
      await expect(migrate(url, quiet, dir)).rejects.toThrow(/MIG-002/);
    });
  });

  it("the full migration set applies cleanly to an empty database", async () => {
    await withScratchDb(async (url) => {
      await migrate(url, quiet);
      const c = await connect(url);
      const t = await c.query("SELECT to_regclass('audit_log')::text AS a, to_regclass('graphile_worker.jobs')::text AS j");
      expect(t.rows[0].a).toBe("audit_log");
      expect(t.rows[0].j).toBe("graphile_worker.jobs");
      await c.end();
    });
  });

  it("T-INV8-04 · no password columns exist in the schema", async () => {
    const c = await connect(OWNER_URL);
    const r = await c.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name ~* '(password|passwd|pwd)'",
    );
    expect(r.rows).toEqual([]);
    await c.end();
  });
});
