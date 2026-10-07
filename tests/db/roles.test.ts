import { beforeAll, describe, expect, it } from "vitest";
import { grantRole, listRoles, revokeRole, StepUpRequired } from "../../src/domain/roles";
import { NotFoundError } from "../../src/lib/permissions";
import { OWNER_URL, connect } from "./helpers";
import { actorFor, createOrg, createPerson, createProgramme, type TestOrg } from "./factory";

let org: TestOrg;
beforeAll(async () => { org = await createOrg("roles"); });

async function auditActions(): Promise<string[]> {
  const c = await connect(OWNER_URL);
  try { await c.query("BEGIN"); await c.query("SELECT set_config('app.org_id', $1, true)", [org.id]); const r = await c.query("SELECT action FROM audit_log"); await c.query("ROLLBACK"); return r.rows.map((x) => x.action); } finally { await c.end(); }
}

describe("Roles (FR-TEN-010, matrix §4.1)", () => {
  it("an org admin with a fresh authenticator step-up can grant org_admin; without it the grant is refused", async () => {
    const admin = await createPerson(org, { roles: [{ role: "org_admin" }] });
    const target = await createPerson(org);
    const stale = (await actorFor(org, admin, { totpVerified: false })).actor;
    await expect(grantRole(stale, { membershipId: target.membershipId, role: "org_admin", scopeType: "org", scopeId: null })).rejects.toThrow(StepUpRequired);
    const fresh = (await actorFor(org, admin, { totpVerified: true })).actor;
    const id = await grantRole(fresh, { membershipId: target.membershipId, role: "org_admin", scopeType: "org", scopeId: null });
    expect(id).toBeTruthy();
    expect(await auditActions()).toContain("role.grant");
  });

  it("a PM may grant assessor inside their programme only, and cannot grant PM or org_admin", async () => {
    const { programmeId } = await createProgramme(org);
    const other = await createProgramme(org);
    const pm = await createPerson(org, { roles: [{ role: "pm", scopeType: "programme", scopeId: programmeId }] });
    const target = await createPerson(org);
    const { actor } = await actorFor(org, pm, { totpVerified: true });
    expect(await grantRole(actor, { membershipId: target.membershipId, role: "assessor", scopeType: "programme", scopeId: programmeId })).toBeTruthy();
    await expect(grantRole(actor, { membershipId: target.membershipId, role: "assessor", scopeType: "programme", scopeId: other.programmeId })).rejects.toThrow(NotFoundError);
    await expect(grantRole(actor, { membershipId: target.membershipId, role: "pm", scopeType: "programme", scopeId: programmeId })).rejects.toThrow(NotFoundError);
    await expect(grantRole(actor, { membershipId: target.membershipId, role: "org_admin", scopeType: "org", scopeId: null })).rejects.toThrow(NotFoundError);
  });

  it("a PM sees only the grants inside their scope; participants cannot list roles at all (not found)", async () => {
    const { programmeId } = await createProgramme(org);
    const pm = await createPerson(org, { roles: [{ role: "pm", scopeType: "programme", scopeId: programmeId }] });
    const outsider = await createPerson(org);
    const { actor } = await actorFor(org, pm);
    const rows = await listRoles(actor);
    expect(rows.every((r) => r.scopeId === programmeId)).toBe(true);
    await expect(listRoles((await actorFor(org, outsider)).actor)).rejects.toThrow(NotFoundError);
  });

  it("the last organisation admin cannot be removed", async () => {
    const solo = await createOrg("solo");
    const admin = await createPerson(solo, { roles: [{ role: "org_admin" }] });
    const { actor } = await actorFor(solo, admin, { totpVerified: true });
    const rows = await listRoles(actor);
    await expect(revokeRole(actor, rows[0]!.id)).rejects.toThrow(NotFoundError);
  });

  it("a grant to someone in another organisation is not found (tenant isolation)", async () => {
    const other = await createOrg("other");
    const foreign = await createPerson(other);
    const admin = await createPerson(org, { roles: [{ role: "org_admin" }] });
    const { actor } = await actorFor(org, admin, { totpVerified: true });
    await expect(grantRole(actor, { membershipId: foreign.membershipId, role: "pm", scopeType: "org", scopeId: null })).rejects.toThrow(NotFoundError);
  });
});
