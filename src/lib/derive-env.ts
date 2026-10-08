import { createHmac } from "node:crypto";

/**
 * Hosted deployments (Render blueprint, AWS Lightsail) hand the app the database HOST/PORT/NAME plus secrets
 * instead of finished connection strings. This builds the connection URLs from them:
 *   DATABASE_URL            runtime role mh_app
 *   MIGRATION_DATABASE_URL  owner role mh_owner (migrations only)
 *   ADMIN_DATABASE_URL      the platform's database master user (role setup only), from ADMIN_USER / ADMIN_PASSWORD
 * Role passwords are OWNER_PASSWORD / APP_PASSWORD when given, otherwise derived from SESSION_SECRET with HMAC-SHA256
 * (the role setup re-applies them on every start, so rotating SESSION_SECRET is safe).
 * DB_SSL=1 adds encrypted transport without certificate-name checks (managed databases with private certificates).
 * Explicit *_URL values always win. Nothing is defaulted: a missing part leaves the URL unset and the env check
 * refuses to start (INV-8).
 */
export function derivedPassword(sessionSecret: string, role: "owner" | "app"): string {
  return createHmac("sha256", sessionSecret).update(`mentors-hub:db:${role}`).digest("hex").slice(0, 48);
}

export function deriveEnv(source: Record<string, string | undefined>): Record<string, string | undefined> {
  const out = { ...source };
  const { DB_HOST, DB_PORT, DB_NAME, SESSION_SECRET, ADMIN_USER, ADMIN_PASSWORD } = source;
  if (DB_HOST && DB_NAME) {
    const q = source.DB_SSL === "1" ? "?sslmode=no-verify" : "";
    const hostPart = (db: string) => `${DB_HOST}:${DB_PORT || "5432"}/${encodeURIComponent(db)}${q}`;
    const ownerPw = source.OWNER_PASSWORD || (SESSION_SECRET && SESSION_SECRET.length >= 32 ? derivedPassword(SESSION_SECRET, "owner") : undefined);
    const appPw = source.APP_PASSWORD || (SESSION_SECRET && SESSION_SECRET.length >= 32 ? derivedPassword(SESSION_SECRET, "app") : undefined);
    if (ownerPw) out.OWNER_PASSWORD = ownerPw;
    if (appPw) out.APP_PASSWORD = appPw;
    if (!out.DATABASE_URL && appPw) out.DATABASE_URL = `postgres://mh_app:${encodeURIComponent(appPw)}@${hostPart(DB_NAME)}`;
    if (!out.MIGRATION_DATABASE_URL && ownerPw) out.MIGRATION_DATABASE_URL = `postgres://mh_owner:${encodeURIComponent(ownerPw)}@${hostPart(DB_NAME)}`;
    // The master user connects to the maintenance database "postgres"; the role setup creates DB_NAME if it is missing.
    if (!out.ADMIN_DATABASE_URL && ADMIN_USER && ADMIN_PASSWORD)
      out.ADMIN_DATABASE_URL = `postgres://${encodeURIComponent(ADMIN_USER)}:${encodeURIComponent(ADMIN_PASSWORD)}@${hostPart("postgres")}`;
  }
  return out;
}

/** For scripts that read process.env directly. */
export function applyDerivedEnv(): void {
  Object.assign(process.env, deriveEnv(process.env));
}
