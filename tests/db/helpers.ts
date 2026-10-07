import pg from "pg";

export const OWNER_URL = process.env.MIGRATION_DATABASE_URL!;
export const APP_URL = process.env.DATABASE_URL!;

export async function connect(url: string): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  return c;
}

/** Run `fn` as the app role in one transaction, with an optional organisation context (like src/lib/db.ts). */
export async function asApp<T>(orgId: string | null, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = await connect(APP_URL);
  try {
    await c.query("BEGIN");
    if (orgId !== null) await c.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await c.end();
  }
}

/** Create a synthetic organisation as the owner (organisations are managed by platform tooling, not the app role). */
export async function makeOrg(slug: string): Promise<string> {
  const c = await connect(OWNER_URL);
  try {
    const r = await c.query<{ id: string }>(
      `INSERT INTO organisation (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [`Test ${slug}`, slug],
    );
    return r.rows[0]!.id;
  } finally {
    await c.end();
  }
}

/** Create a scratch database for tests that need a clean slate; always dropped afterwards. */
export async function withScratchDb<T>(fn: (ownerUrl: string) => Promise<T>): Promise<T> {
  const name = `mh_scratch_${process.pid}_${Date.now()}`;
  const admin = await connect(OWNER_URL);
  await admin.query(`CREATE DATABASE ${name}`);
  const u = new URL(OWNER_URL);
  u.pathname = `/${name}`;
  try {
    return await fn(u.toString());
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  }
}

/** Read/write tenant tables as the OWNER role inside a transaction with an organisation context (forced RLS applies to owners too). */
export async function ownerOrg<T>(orgId: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = await connect(OWNER_URL);
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await c.end();
  }
}
