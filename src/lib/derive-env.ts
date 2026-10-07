/**
 * Hosted deployments (Render blueprint) hand the app the database HOST/PORT/NAME plus two generated
 * passwords instead of finished connection strings. This builds the two connection URLs from them
 * (owner role for migrations, app role for runtime). Explicit DATABASE_URL / MIGRATION_DATABASE_URL
 * always win. Nothing is defaulted: a missing part leaves the URL unset and the env check refuses to start (INV-8).
 */
export function deriveEnv(source: Record<string, string | undefined>): Record<string, string | undefined> {
  const out = { ...source };
  const { DB_HOST, DB_PORT, DB_NAME, OWNER_PASSWORD, APP_PASSWORD } = source;
  if (DB_HOST && DB_NAME) {
    const hostPart = `${DB_HOST}:${DB_PORT || "5432"}/${encodeURIComponent(DB_NAME)}`;
    if (!out.DATABASE_URL && APP_PASSWORD) out.DATABASE_URL = `postgres://mh_app:${encodeURIComponent(APP_PASSWORD)}@${hostPart}`;
    if (!out.MIGRATION_DATABASE_URL && OWNER_PASSWORD)
      out.MIGRATION_DATABASE_URL = `postgres://mh_owner:${encodeURIComponent(OWNER_PASSWORD)}@${hostPart}`;
  }
  return out;
}

/** For scripts that read process.env directly. */
export function applyDerivedEnv(): void {
  Object.assign(process.env, deriveEnv(process.env));
}
