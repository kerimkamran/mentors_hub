import { beforeAll, describe, expect, it } from "vitest";
import { APP_URL, OWNER_URL, asApp, connect, makeOrg } from "./helpers";

let orgA: string;
let orgB: string;

beforeAll(async () => {
  orgA = await makeOrg("spike-a");
  orgB = await makeOrg("spike-b");
  // Seed audit rows for both organisations through the real app path (RLS WITH CHECK applies).
  await asApp(orgA, (c) => c.query("INSERT INTO audit_log (organisation_id, action, status) VALUES ($1, 'spike.a', 'ok')", [orgA]));
  await asApp(orgB, (c) => c.query("INSERT INTO audit_log (organisation_id, action, status) VALUES ($1, 'spike.b', 'ok')", [orgB]));
});

describe("INV-1 · tenant isolation (S0 spike: the app role cannot bypass row-level security)", () => {
  it("T-INV1-04 · app role is not superuser, has no BYPASSRLS, and owns no tables", async () => {
    const c = await connect(OWNER_URL);
    const role = await c.query("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'mh_app'");
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const owned = await c.query(
      "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tableowner = 'mh_app'",
    );
    expect(owned.rows[0].n).toBe(0);
    await c.end();
  });

  it("T-INV1-01 · every non-allowlisted table has RLS enabled and forced", async () => {
    const { GLOBAL_TABLES } = await import("../../scripts/lint-migrations");
    const c = await connect(OWNER_URL);
    const r = await c.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`,
    );
    for (const t of r.rows.filter((t) => !GLOBAL_TABLES.has(t.relname))) {
      expect(t.relrowsecurity, `${t.relname} must ENABLE RLS`).toBe(true);
      expect(t.relforcerowsecurity, `${t.relname} must FORCE RLS`).toBe(true);
    }
    await c.end();
  });

  it("T-INV1-02 · with context A, B's rows are invisible and cannot be written", async () => {
    const rows = await asApp(orgA, (c) => c.query("SELECT organisation_id, action FROM audit_log"));
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(new Set(rows.rows.map((r) => r.organisation_id))).toEqual(new Set([orgA]));

    await expect(
      asApp(orgA, (c) => c.query("INSERT INTO audit_log (organisation_id, action, status) VALUES ($1, 'spike.x', 'ok')", [orgB])),
    ).rejects.toThrow(/row-level security/);
  });

  it("T-INV1-03 · with no context, select returns nothing and insert fails (fail closed)", async () => {
    const rows = await asApp(null, (c) => c.query("SELECT 1 FROM audit_log"));
    expect(rows.rows.length).toBe(0);
    await expect(
      asApp(null, (c) => c.query("INSERT INTO audit_log (organisation_id, action, status) VALUES ($1, 'spike.x', 'ok')", [orgA])),
    ).rejects.toThrow(/row-level security/);
  });

  it("an empty context behaves like no context; a malformed one is an error, never a match", async () => {
    const empty = await asApp("", (c) => c.query("SELECT 1 FROM audit_log"));
    expect(empty.rows.length).toBe(0);
    const c = await connect(APP_URL);
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.org_id', 'not-a-uuid', true)");
    await expect(c.query("SELECT 1 FROM audit_log")).rejects.toThrow();
    await c.query("ROLLBACK");
    await c.end();
  });

  it("the context dies with the transaction and cannot leak to the next request", async () => {
    const c = await connect(APP_URL);
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.org_id', $1, true)", [orgA]);
    await c.query("COMMIT");
    const after = await c.query("SELECT count(*)::int AS n FROM audit_log");
    expect(after.rows[0].n).toBe(0);
    await c.end();
  });

  it("the app role cannot create tables, disable RLS or write global tables", async () => {
    await expect(asApp(orgA, (c) => c.query("CREATE TABLE sneaky (id int)"))).rejects.toThrow();
    await expect(asApp(orgA, (c) => c.query("ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY"))).rejects.toThrow();
    await expect(asApp(orgA, (c) => c.query("INSERT INTO organisation (name, slug) VALUES ('x','xx')"))).rejects.toThrow();
  });

  it("audit_log is append-only for everyone, owner included (INV-3)", async () => {
    // The app role has no UPDATE/DELETE privilege at all (and RLS has no such policy either).
    await expect(asApp(orgA, (c) => c.query("UPDATE audit_log SET status = 'failed'"))).rejects.toThrow(/permission denied/);
    await expect(asApp(orgA, (c) => c.query("DELETE FROM audit_log"))).rejects.toThrow(/permission denied/);
    const owner = await connect(OWNER_URL);
    await owner.query("BEGIN");
    await owner.query("SELECT set_config('app.org_id', $1, true)", [orgA]); // owner is subject to forced RLS too
    // With no DELETE policy even the owner sees nothing to delete; the trigger is defence in depth.
    const del = await owner.query("DELETE FROM audit_log");
    expect(del.rowCount).toBe(0);
    const still = await owner.query("SELECT count(*)::int AS n FROM audit_log");
    expect(still.rows[0].n).toBeGreaterThan(0);
    await owner.query("ROLLBACK");
    await expect(owner.query("TRUNCATE audit_log")).rejects.toThrow(/append-only/);
    await owner.end();
  });

  it("audit_log accepts codes only, never sentences (no free text)", async () => {
    await expect(
      asApp(orgA, (c) => c.query("INSERT INTO audit_log (organisation_id, action, status) VALUES ($1, 'Alice read Bob''s note', 'ok')", [orgA])),
    ).rejects.toThrow(/check constraint/);
  });

  it("T-INV1-07 · organisation_id cannot be changed (trigger helper)", async () => {
    const c = await connect(OWNER_URL);
    await c.query("BEGIN");
    await c.query("CREATE TEMP TABLE t_probe (id int, organisation_id uuid)");
    await c.query("CREATE TRIGGER t BEFORE UPDATE ON t_probe FOR EACH ROW EXECUTE FUNCTION mh_forbid_org_change()");
    await c.query("INSERT INTO t_probe VALUES (1, $1)", [orgA]);
    await expect(c.query("UPDATE t_probe SET organisation_id = $1", [orgB])).rejects.toThrow(/immutable/);
    await c.query("ROLLBACK");
    await c.end();
  });
});
