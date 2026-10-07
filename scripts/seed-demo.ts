/**
 * Seeds the synthetic "Demo Telecom" organisation (Plan §12). Runs as the OWNER role: organisations
 * and identities are provisioned by platform tooling, not by the app role. Idempotent.
 * Never run against production: it refuses unless DEMO_SEED=1 (staging/local only).
 */
import pg from "pg";

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
  await c.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
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
    for (const role of p.roles ?? [])
      await c.query(
        `INSERT INTO role_grant (organisation_id, membership_id, role, scope_type) VALUES ($1, $2, $3, 'org') ON CONFLICT DO NOTHING`,
        [orgId, m.rows[0]!.id, role],
      );
  }
  await c.query("COMMIT");
  console.log(`seeded Demo Telecom (${PEOPLE.length} synthetic people); sign in with admin@demo-telecom.example`);
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  await c.end();
}
