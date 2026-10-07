import { Pool, type PoolClient } from "pg";
import { env } from "./env";

/**
 * The ONLY module allowed to import `pg` (ESLint rule, T-INV1-05).
 *
 * - Tenant data is reachable only through `withOrg`, which sets the organisation for the
 *   current transaction (`app.org_id`). Row-level security does the rest (INV-1.3).
 * - The organisation id must come from the signed-in session, never from a URL, form field
 *   or header (INV-1.5). From S1 the session layer is the only caller of `withOrg`.
 * - `withGlobal` runs with no organisation context: only allowlisted global tables answer.
 * - The raw pool is not exported.
 */
let pool: Pool | undefined;
function getPool(): Pool {
  pool ??= new Pool({ connectionString: env().DATABASE_URL, max: 10 });
  return pool;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Tx = Pick<PoolClient, "query">;

async function inTransaction<T>(orgId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (orgId !== null) {
      // is_local = true: the setting dies with the transaction and cannot leak between requests.
      await client.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
    }
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export async function withOrg<T>(orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(orgId)) throw new Error("withOrg: organisation id must be a UUID");
  return inTransaction(orgId, fn);
}

export async function withGlobal<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inTransaction(null, fn);
}

export async function ping(): Promise<boolean> {
  try {
    await withGlobal((tx) => tx.query("SELECT 1"));
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
