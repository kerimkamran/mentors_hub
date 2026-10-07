import { audit } from "@/lib/audit";
import { hasFreshStepUp } from "@/lib/auth/core";
import { withOrg } from "@/lib/db";
import { authorize, NotFoundError, type Actor, type Grant, type Role, type ScopeType } from "@/lib/permissions";

export class StepUpRequired extends Error {
  constructor() {
    super("step-up required");
  }
}

export interface RoleRow {
  id: string;
  membershipId: string;
  displayName: string;
  role: Role;
  scopeType: ScopeType;
  scopeId: string | null;
}

const scopeResource = (scopeType: ScopeType, scopeId: string | null) =>
  scopeType === "programme" ? { programmeId: scopeId ?? undefined } : scopeType === "cohort" ? { cohortId: scopeId ?? undefined } : {};

export async function listRoles(actor: Actor): Promise<RoleRow[]> {
  authorize(actor, "role.list");
  const r = await withOrg(actor.organisationId, (tx) =>
    tx.query(
      `SELECT g.id, g.membership_id, p.display_name, g.role, g.scope_type, g.scope_id
       FROM role_grant g JOIN person_profile p ON p.membership_id = g.membership_id
       ORDER BY p.display_name, g.role`,
    ),
  );
  return r.rows
    .map((x): RoleRow => ({ id: x.id, membershipId: x.membership_id, displayName: x.display_name, role: x.role, scopeType: x.scope_type, scopeId: x.scope_id }))
    // A PM sees only the grants inside their own scope (matrix §4.1).
    .filter((x) => actor.roles.some((g) => g.role === "org_admin" && g.scopeType === "org") || can(actor, x));
}
function can(actor: Actor, x: RoleRow): boolean {
  return actor.roles.some(
    (g) => g.role === "pm" && ((g.scopeType === "programme" && x.scopeType === "programme" && g.scopeId === x.scopeId) || (g.scopeType === "cohort" && x.scopeType === "cohort" && g.scopeId === x.scopeId)),
  );
}

export interface GrantInput {
  membershipId: string;
  role: Role;
  scopeType: ScopeType;
  scopeId: string | null;
}

/** Grant a role. Permission is checked per role (PM may grant only assessor within their scope). org_admin grants need a fresh authenticator step-up. */
export async function grantRole(actor: Actor, input: GrantInput, now = new Date()): Promise<string> {
  authorize(actor, `role.grant.${input.role}`, scopeResource(input.scopeType, input.scopeId));
  if (input.role === "org_admin" && !hasFreshStepUp(actor, now)) throw new StepUpRequired();
  return withOrg(actor.organisationId, async (tx) => {
    const m = await tx.query("SELECT 1 FROM membership WHERE id = $1 AND status = 'active'", [input.membershipId]);
    if (!m.rowCount) throw new NotFoundError();
    const r = await tx.query<{ id: string }>(
      `INSERT INTO role_grant (organisation_id, membership_id, role, scope_type, scope_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING RETURNING id`,
      [actor.organisationId, input.membershipId, input.role, input.scopeType, input.scopeId, actor.membershipId],
    );
    const id = r.rows[0]?.id ?? "";
    if (id) await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "role.grant", objectType: "role_grant", objectId: id });
    return id;
  });
}

export async function revokeRole(actor: Actor, grantId: string, now = new Date()): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    const g = await tx.query<{ role: Role; scope_type: ScopeType; scope_id: string | null }>("SELECT role, scope_type, scope_id FROM role_grant WHERE id = $1", [grantId]);
    const row = g.rows[0];
    if (!row) throw new NotFoundError();
    authorize(actor, `role.grant.${row.role}`, scopeResource(row.scope_type, row.scope_id));
    if (row.role === "org_admin") {
      if (!hasFreshStepUp(actor, now)) throw new StepUpRequired();
      const n = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM role_grant WHERE role = 'org_admin' AND scope_type = 'org'");
      if (n.rows[0]!.n <= 1) throw new NotFoundError(); // never remove the last organisation admin
    }
    await tx.query("DELETE FROM role_grant WHERE id = $1", [grantId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "role.revoke", objectType: "role_grant", objectId: grantId });
  });
}

export type { Grant };
