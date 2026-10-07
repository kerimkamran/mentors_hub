/**
 * Test factory: creates synthetic organisations, people, roles and signed-in actors as the OWNER role
 * (platform tooling), so feature tests can then act through the real app-role code paths.
 * Every test file should create its OWN organisation (unique slug) so files never interfere.
 */
import { randomBytes } from "node:crypto";
import { sha256Hex } from "../../src/lib/crypto";
import { resolveSession } from "../../src/lib/auth/core";
import type { Actor, Role, ScopeType } from "../../src/lib/permissions";
import { OWNER_URL, connect } from "./helpers";

export interface TestOrg {
  id: string;
  slug: string;
  domain: string;
}

export async function createOrg(prefix = "t"): Promise<TestOrg> {
  const slug = `${prefix.toLowerCase()}-${randomBytes(4).toString("hex")}`;
  const domain = `${slug}.example`;
  const c = await connect(OWNER_URL);
  try {
    const r = await c.query<{ id: string }>("INSERT INTO organisation (name, slug) VALUES ($1, $2) RETURNING id", [`Org ${slug}`, slug]);
    await c.query("INSERT INTO organisation_domain (domain, organisation_id) VALUES ($1, $2)", [domain, r.rows[0]!.id]);
    return { id: r.rows[0]!.id, slug, domain };
  } finally {
    await c.end();
  }
}

export interface TestPerson {
  identityId: string;
  membershipId: string;
  email: string;
  name: string;
}

export async function createPerson(
  org: TestOrg,
  o: { name?: string; email?: string; status?: "active" | "inactive" | "invited"; roles?: { role: Role; scopeType?: ScopeType; scopeId?: string | null }[]; department?: string } = {},
): Promise<TestPerson> {
  const id = randomBytes(4).toString("hex");
  const email = o.email ?? `p${id}@${org.domain}`;
  const name = o.name ?? `Person ${id}`;
  const c = await connect(OWNER_URL);
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.org_id', $1, true)", [org.id]);
    const i = await c.query<{ id: string }>("INSERT INTO identity (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id", [email]);
    const m = await c.query<{ id: string }>(
      "INSERT INTO membership (organisation_id, identity_id, status, source) VALUES ($1, $2, $3, 'import') RETURNING id",
      [org.id, i.rows[0]!.id, o.status ?? "active"],
    );
    await c.query("INSERT INTO person_profile (membership_id, organisation_id, display_name, department) VALUES ($1, $2, $3, $4)", [m.rows[0]!.id, org.id, name, o.department ?? "Dept"]);
    for (const r of o.roles ?? [])
      await c.query("INSERT INTO role_grant (organisation_id, membership_id, role, scope_type, scope_id) VALUES ($1, $2, $3, $4, $5)", [
        org.id, m.rows[0]!.id, r.role, r.scopeType ?? "org", r.scopeId ?? null,
      ]);
    await c.query("COMMIT");
    return { identityId: i.rows[0]!.id, membershipId: m.rows[0]!.id, email, name };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}

/** A real signed-in session for `person`, resolved through the production code path. */
export async function actorFor(org: TestOrg, person: TestPerson, o: { totpVerified?: boolean } = {}): Promise<{ actor: Actor; token: string }> {
  const token = randomBytes(24).toString("base64url");
  const c = await connect(OWNER_URL);
  try {
    await c.query(
      `INSERT INTO web_session (token_hash, identity_id, organisation_id, membership_id, expires_at, totp_verified_at)
       VALUES ($1, $2, $3, $4, now() + interval '1 day', $5)`,
      [sha256Hex(token), person.identityId, org.id, person.membershipId, o.totpVerified ? new Date() : null],
    );
  } finally {
    await c.end();
  }
  const actor = await resolveSession(token);
  if (!actor) throw new Error("test actor did not resolve");
  return { actor, token };
}

export async function createProgramme(org: TestOrg, type: "leadership" | "sparklab" | "open" = "leadership", name = "Programme") {
  const c = await connect(OWNER_URL);
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.org_id', $1, true)", [org.id]);
    const p = await c.query<{ id: string }>("INSERT INTO programme (organisation_id, type, name, status) VALUES ($1, $2, $3, 'active') RETURNING id", [org.id, type, name]);
    const k = await c.query<{ id: string }>("INSERT INTO cohort (organisation_id, programme_id, name, status) VALUES ($1, $2, 'Cohort 1', 'running') RETURNING id", [org.id, p.rows[0]!.id]);
    await c.query("COMMIT");
    return { programmeId: p.rows[0]!.id, cohortId: k.rows[0]!.id };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}
