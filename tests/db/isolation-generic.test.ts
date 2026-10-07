import { beforeAll, describe, expect, it } from "vitest";
import { GLOBAL_TABLES } from "../../scripts/lint-migrations";
import { APP_URL, OWNER_URL, connect, ownerOrg } from "./helpers";
import { createOrg, createPerson, createProgramme, type TestOrg } from "./factory";

/**
 * T-INV1-02 / T-INV1-03 for EVERY tenant table, discovered from the catalogue — new tables are covered
 * automatically. A is the acting organisation; B is the victim. Rows exist for B in the core tables.
 */
let A: TestOrg, B: TestOrg;
let tables: string[] = [];

beforeAll(async () => {
  A = await createOrg("isoA");
  B = await createOrg("isoB");
  await createPerson(A); await createPerson(B, { roles: [{ role: "org_admin" }] });
  await createProgramme(A); await createProgramme(B);
  const c = await connect(OWNER_URL);
  const r = await c.query<{ relname: string }>(
    `SELECT c.relname FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'organisation_id' AND NOT a.attisdropped
     WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' ORDER BY 1`,
  );
  await c.end();
  tables = r.rows.map((x) => x.relname).filter((t) => !GLOBAL_TABLES.has(t));
});

describe("T-INV1-02/03 · every tenant table is isolated at the database", () => {
  it("discovers the tenant tables (guard against an empty sweep)", () => {
    for (const t of ["membership", "role_grant", "programme", "cohort", "participation", "relationship", "audit_log", "consent", "person_profile"]) expect(tables).toContain(t);
  });

  it("with context A: B's rows are invisible, un-updatable and un-deletable; with no context nothing is visible", async () => {
    for (const t of tables) {
      const bRows = await ownerOrg(B.id, (c) => c.query(`SELECT count(*)::int AS n FROM ${t} WHERE organisation_id = $1`, [B.id]));
      const app = await connect(APP_URL);
      try {
        await app.query("BEGIN");
        await app.query("SELECT set_config('app.org_id', $1, true)", [A.id]);
        const seen = await app.query(`SELECT count(*)::int AS n FROM ${t} WHERE organisation_id = $1`, [B.id]);
        expect(seen.rows[0].n, `${t}: A sees B's rows (B has ${bRows.rows[0].n})`).toBe(0);
        for (const sql of [`UPDATE ${t} SET organisation_id = organisation_id WHERE organisation_id = $1`, `DELETE FROM ${t} WHERE organisation_id = $1`]) {
          await app.query("SAVEPOINT s");
          try {
            const r = await app.query(sql, [B.id]);
            expect(r.rowCount, `${t}: ${sql.split(" ")[0]} affected B's rows`).toBe(0);
          } catch (e) {
            expect(String((e as Error).message), `${t}: unexpected error`).toMatch(/permission denied|append-only|immutable/); // no privilege is also a pass
            await app.query("ROLLBACK TO s");
          }
        }
        await app.query("ROLLBACK");
        await app.query("BEGIN"); // no context at all
        const none = await app.query(`SELECT count(*)::int AS n FROM ${t}`);
        expect(none.rows[0].n, `${t}: rows visible with no context`).toBe(0);
        await app.query("ROLLBACK");
      } finally {
        await app.end();
      }
    }
  });

  it("every tenant table also has the organisation_id-immutability trigger or no UPDATE privilege for the app role", async () => {
    const c = await connect(OWNER_URL);
    for (const t of tables) {
      const trg = await c.query("SELECT 1 FROM pg_trigger WHERE tgrelid = $1::regclass AND tgname LIKE 'org_immutable_%' OR tgrelid = $1::regclass AND tgfoid::regproc::text = 'mh_forbid_org_change'", [t]);
      const priv = await c.query("SELECT has_table_privilege('mh_app', $1, 'UPDATE') AS u", [t]);
      expect(trg.rowCount! > 0 || priv.rows[0].u === false, `${t}: organisation_id can be changed (T-INV1-07)`).toBe(true);
    }
    await c.end();
  });
});
