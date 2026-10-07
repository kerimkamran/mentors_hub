/**
 * Migration lint (INV-1.1, INV-1.2, INV-1.6, INV-8.4, T-INV8-04), applied to the SQL text.
 * Every CREATE TABLE must be on the global allowlist OR carry organisation_id, ENABLE + FORCE RLS.
 * No password/credential columns may exist anywhere.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Explicit allowlist of global (non-tenant) tables, INV-1.6. Extend only with spec approval. */
export const GLOBAL_TABLES = new Set([
  "organisation",
  "schema_migrations",
  // Sign-in and sessions must resolve before an organisation context exists (the organisation comes from the session row).
  "organisation_domain",
  "identity",
  "login_challenge",
  "web_session",
  "auth_rate_limit",
]);

export function lintMigrationSql(sql: string, name = "migration"): string[] {
  const problems: string[] = [];
  const tables = [...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\);/gi)];
  for (const m of tables) {
    const table = m[1]!.toLowerCase();
    const body = m[2]!;
    if (/\b(password|passwd|pwd)\b/i.test(body)) problems.push(`${name}: ${table} has a password-like column (INV-8.4)`);
    if (GLOBAL_TABLES.has(table)) continue;
    if (!/\borganisation_id\s+uuid\s+NOT NULL\s+REFERENCES\s+organisation\b/i.test(body))
      problems.push(`${name}: tenant table ${table} lacks organisation_id uuid NOT NULL REFERENCES organisation (INV-1.1)`);
    if (!new RegExp(`ALTER TABLE\\s+${table}\\s+ENABLE ROW LEVEL SECURITY`, "i").test(sql))
      problems.push(`${name}: ${table} does not ENABLE ROW LEVEL SECURITY (INV-1.2)`);
    if (!new RegExp(`ALTER TABLE\\s+${table}\\s+FORCE ROW LEVEL SECURITY`, "i").test(sql))
      problems.push(`${name}: ${table} does not FORCE ROW LEVEL SECURITY (INV-1.2)`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
  const problems = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .flatMap((f) => lintMigrationSql(readFileSync(join(dir, f), "utf8"), f));
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("migration lint OK");
}
