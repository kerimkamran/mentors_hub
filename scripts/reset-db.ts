/** Development helper: drops and recreates the public schema, then re-migrates. Refuses non-local hosts. */
import pg from "pg";
import { migrate } from "./migrate";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is required");
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "db"].includes(host)) {
  console.error(`refusing to reset non-local database host`);
  process.exit(1);
}
const c = new pg.Client({ connectionString: url });
await c.connect();
await c.query("DROP SCHEMA IF EXISTS graphile_worker CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
await c.end();
await migrate(url);
