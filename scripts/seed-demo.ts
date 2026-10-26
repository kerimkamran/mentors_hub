/**
 * Seeds the synthetic "Demo Telecom" organisation (Plan §12). Runs as the OWNER role: organisations
 * and identities are provisioned by platform tooling, not by the app role. Idempotent.
 * Never run against production: it refuses unless DEMO_SEED=1 (staging/local only).
 */
import pg from "pg";
import { randomToken, sha256Hex } from "../src/lib/crypto";
import { hashPassword } from "../src/lib/auth/password";
import { applyDerivedEnv } from "../src/lib/derive-env";

applyDerivedEnv();

if (process.env.DEMO_SEED !== "1") {
  console.error("refusing to seed: set DEMO_SEED=1 (staging/local only, synthetic data)");
  process.exit(1);
}
const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is required");

const PEOPLE: { email: string; name: string; dept: string; roles?: string[] }[] = [
  { email: "admin@demo-telecom.example", name: "Aysel Admin", dept: "IT", roles: ["org_admin"] },
  { email: "admin2@demo-telecom.example", name: "Elchin Second-Admin", dept: "IT", roles: ["org_admin"] },
  { email: "pm@demo-telecom.example", name: "Nigar Manager", dept: "HR", roles: ["pm"] },
  { email: "safeguard@demo-telecom.example", name: "Sabina Safeguard", dept: "HR", roles: ["safeguarding"] },
  { email: "mentor1@demo-telecom.example", name: "Rauf Mammadov", dept: "Engineering" },
  { email: "mentor2@demo-telecom.example", name: "Leyla Huseynova", dept: "Sales" },
  { email: "mentee1@demo-telecom.example", name: "Tural Aliyev", dept: "Engineering" },
  { email: "mentee2@demo-telecom.example", name: "Gunel Qasimova", dept: "Marketing" },
];

// Optional: make one real person an organisation admin of the demo organisation (staging convenience).
const extraAdmin = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase();
if (extraAdmin && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(extraAdmin)) PEOPLE.push({ email: extraAdmin, name: "Demo Administrator", dept: "IT", roles: ["org_admin"] });

// Optional: one ordinary (no role) user for staging. Initial passwords come ONLY from the environment (DEMO_ADMIN_PASSWORD,
// DEMO_USER_PASSWORD), never from the repository. They are hashed here; a password is applied only when the person has none
// yet, unless RESET_PASSWORDS=1 is set for one start. Nothing is seeded with a password when the variables are absent.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const extraUser = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
if (extraUser && EMAIL.test(extraUser) && extraUser !== extraAdmin) PEOPLE.push({ email: extraUser, name: "Demo User", dept: "HR" });
const initialPassword = new Map<string, string>();
if (extraAdmin && process.env.DEMO_ADMIN_PASSWORD) initialPassword.set(extraAdmin, process.env.DEMO_ADMIN_PASSWORD);
if (extraUser && process.env.DEMO_USER_PASSWORD) initialPassword.set(extraUser, process.env.DEMO_USER_PASSWORD);
const passwordHashes = new Map<string, string>();
for (const [email, pw] of initialPassword) passwordHashes.set(email, await hashPassword(pw));

const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  await c.query("BEGIN");
  const org = await c.query<{ id: string }>(
    `INSERT INTO organisation (name, slug, default_locale) VALUES ('Demo Telecom', 'demo-telecom', 'en')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  );
  const orgId = org.rows[0]!.id;
  await c.query("INSERT INTO organisation_domain (domain, organisation_id) VALUES ('demo-telecom.example', $1) ON CONFLICT DO NOTHING", [orgId]);
  for (const e of [extraAdmin, extraUser])
    if (e && EMAIL.test(e))
      await c.query("INSERT INTO organisation_domain (domain, organisation_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [e.split("@")[1], orgId]);
  await c.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
  let bootstrap: { identityId: string; membershipId: string } | null = null;
  for (const p of PEOPLE) {
    const i = await c.query<{ id: string }>(
      "INSERT INTO identity (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id",
      [p.email],
    );
    const m = await c.query<{ id: string }>(
      `INSERT INTO membership (organisation_id, identity_id, status, source) VALUES ($1, $2, 'active', 'import')
       ON CONFLICT (organisation_id, identity_id) DO UPDATE SET status = 'active' RETURNING id`,
      [orgId, i.rows[0]!.id],
    );
    await c.query(
      `INSERT INTO person_profile (membership_id, organisation_id, display_name, department) VALUES ($1, $2, $3, $4)
       ON CONFLICT (membership_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [m.rows[0]!.id, orgId, p.name, p.dept],
    );
    const hash = passwordHashes.get(p.email);
    if (hash)
      await c.query(
        `UPDATE identity SET password_hash = $2, password_set_at = now() WHERE id = $1 AND ($3 OR password_hash IS NULL)`,
        [i.rows[0]!.id, hash, process.env.RESET_PASSWORDS === "1"],
      );
    if (p.email === extraAdmin) bootstrap = { identityId: i.rows[0]!.id, membershipId: m.rows[0]!.id };
    for (const role of p.roles ?? [])
      await c.query(
        `INSERT INTO role_grant (organisation_id, membership_id, role, scope_type) VALUES ($1, $2, $3, 'org') ON CONFLICT DO NOTHING`,
        [orgId, m.rows[0]!.id, role],
      );
  }
  // Invite-only access: the bootstrap administrator gets a single-use invite link, printed to the log (staging only),
  // to choose their own password. Once a password exists no new link is printed on later starts, so the log is not a
  // standing way in; set RESET_ADMIN_LINK=1 for one start to print a fresh link (for example after a forgotten password).
  const hasPassword = bootstrap
    ? (await c.query("SELECT 1 FROM identity WHERE id = $1 AND password_hash IS NOT NULL", [bootstrap.identityId])).rowCount! > 0
    : false;
  if (bootstrap && (!hasPassword || process.env.RESET_ADMIN_LINK === "1")) {
    const token = randomToken();
    await c.query("UPDATE invite_link SET used_at = now() WHERE membership_id = $1 AND used_at IS NULL", [bootstrap.membershipId]);
    await c.query(
      `INSERT INTO invite_link (organisation_id, identity_id, membership_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '7 days')`,
      [orgId, bootstrap.identityId, bootstrap.membershipId, sha256Hex(token)],
    );
    const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    console.log(`STAGING invite link for ${extraAdmin}: ${base}/auth/invite?t=${token}`);
  }
  await c.query("COMMIT");
  if (passwordHashes.size) console.log(`initial passwords from the environment applied where none was set (${passwordHashes.size} account(s))`);
  console.log(`seeded Demo Telecom (${PEOPLE.length} synthetic people); sign in with admin@demo-telecom.example`);
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  await c.end();
}
