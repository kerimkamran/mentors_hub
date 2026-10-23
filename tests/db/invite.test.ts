import { beforeAll, describe, expect, it } from "vitest";
import { resolveSession, type AuthDeps } from "../../src/lib/auth/core";
import { InviteError, invitePerson, peekInvite, redeemInvite } from "../../src/lib/auth/invite";
import { sha256Hex } from "../../src/lib/crypto";
import { OWNER_URL, connect } from "./helpers";
import { actorFor, createOrg, createPerson, type TestOrg } from "./factory";

let org: TestOrg;
let other: TestOrg;
const deps: AuthDeps = { enqueueSignInMail: async () => undefined, now: () => new Date(), minRequestMs: 0 };
const uniq = () => Math.random().toString(36).slice(2, 10);

async function owner<T>(fn: (c: Awaited<ReturnType<typeof connect>>) => Promise<T>): Promise<T> {
  const c = await connect(OWNER_URL);
  try { return await fn(c); } finally { await c.end(); }
}

/** Owner connection with an organisation context, so forced row-level security lets the check see tenant rows. */
async function ownerIn<T>(orgId: string, fn: (c: Awaited<ReturnType<typeof connect>>) => Promise<T>): Promise<T> {
  return owner(async (c) => {
    await c.query("SELECT set_config('app.org_id', $1, false)", [orgId]);
    return fn(c);
  });
}

async function admin(o: TestOrg) {
  const p = await createPerson(o, { roles: [{ role: "org_admin" }] });
  return (await actorFor(o, p, { totpVerified: true })).actor;
}

beforeAll(async () => {
  org = await createOrg("invite");
  other = await createOrg("invite-other");
});

describe("invite-only sign-in via administrator invite links", () => {
  it("an administrator creates a person and a single-use link that signs them in and activates them", async () => {
    const a = await admin(org);
    const email = `new-${uniq()}@${org.domain}`;
    const { membershipId, token } = await invitePerson(a, { email: ` ${email.toUpperCase()} `, name: "New Person" });
    expect(token.length).toBeGreaterThan(30);

    const before = await ownerIn(org.id, (c) => c.query("SELECT status FROM membership WHERE id = $1", [membershipId]));
    expect(before.rows[0].status).toBe("invited");

    const done = await redeemInvite(token, deps);
    expect(done).not.toBeNull();
    const actor = await resolveSession(done!.sessionToken);
    expect(actor?.membershipId).toBe(membershipId);

    const after = await ownerIn(org.id, (c) => c.query("SELECT status FROM membership WHERE id = $1", [membershipId]));
    expect(after.rows[0].status).toBe("active");

    // single use: the same link cannot be used again
    expect(await peekInvite(token)).toBe("unusable");
    expect(await redeemInvite(token, deps)).toBeNull();
  });

  it("only administrators can invite (deny by default)", async () => {
    const p = await createPerson(org, { roles: [{ role: "pm" }] });
    const { actor } = await actorFor(org, p, { totpVerified: true });
    await expect(invitePerson(actor, { email: `x-${uniq()}@${org.domain}`, name: "X" })).rejects.toThrow();
    const plain = await createPerson(org);
    const { actor: member } = await actorFor(org, plain);
    await expect(invitePerson(member, { email: `y-${uniq()}@${org.domain}`, name: "Y" })).rejects.toThrow();
  });

  it("peeking at a link (a GET) never consumes it", async () => {
    const a = await admin(org);
    const { token } = await invitePerson(a, { email: `peek-${uniq()}@${org.domain}`, name: "Peek" });
    expect(await peekInvite(token)).toBe("usable");
    expect(await peekInvite(token)).toBe("usable");
    expect(await redeemInvite(token, deps)).not.toBeNull();
  });

  it("an expired link is refused", async () => {
    const a = await admin(org);
    const { token } = await invitePerson(a, { email: `old-${uniq()}@${org.domain}`, name: "Old" });
    await owner((c) => c.query("UPDATE invite_link SET expires_at = now() - interval '1 minute' WHERE token_hash = $1", [sha256Hex(token)]));
    expect(await peekInvite(token)).toBe("unusable");
    expect(await redeemInvite(token, deps)).toBeNull();
  });

  it("an unknown token is refused", async () => {
    expect(await redeemInvite("not-a-real-token", deps)).toBeNull();
  });

  it("inviting again voids the earlier link", async () => {
    const a = await admin(org);
    const email = `again-${uniq()}@${org.domain}`;
    const first = await invitePerson(a, { email, name: "Again" });
    const second = await invitePerson(a, { email, name: "Again" });
    expect(second.membershipId).toBe(first.membershipId);
    expect(await redeemInvite(first.token, deps)).toBeNull();
    expect(await redeemInvite(second.token, deps)).not.toBeNull();
  });

  it("a deactivated person cannot be invited, and a link issued before deactivation fails closed", async () => {
    const a = await admin(org);
    const gone = await createPerson(org, { status: "inactive" });
    await expect(invitePerson(a, { email: gone.email, name: gone.name })).rejects.toBeInstanceOf(InviteError);

    const email = `later-${uniq()}@${org.domain}`;
    const { membershipId, token } = await invitePerson(a, { email, name: "Later" });
    await owner(async (c) => {
      await c.query("SELECT set_config('app.org_id', $1, false)", [org.id]);
      await c.query("UPDATE membership SET status = 'inactive' WHERE id = $1", [membershipId]);
    });
    expect(await redeemInvite(token, deps)).toBeNull();
  });

  it("rejects an invalid email or name", async () => {
    const a = await admin(org);
    await expect(invitePerson(a, { email: "not-an-email", name: "Z" })).rejects.toMatchObject({ reason: "invalid_email" });
    await expect(invitePerson(a, { email: `z-${uniq()}@${org.domain}`, name: "   " })).rejects.toMatchObject({ reason: "invalid_name" });
  });

  it("an invitation is scoped to the inviting administrator's organisation and is audited by code only", async () => {
    const a = await admin(org);
    const { membershipId } = await invitePerson(a, { email: `scope-${uniq()}@${org.domain}`, name: "Scoped" });
    const m = await ownerIn(org.id, (c) => c.query("SELECT organisation_id FROM membership WHERE id = $1", [membershipId]));
    expect(m.rows[0].organisation_id).toBe(org.id);
    const stray = await ownerIn(other.id, (c) => c.query("SELECT 1 FROM membership WHERE id = $1 AND organisation_id = $2", [membershipId, other.id]));
    expect(stray.rowCount).toBe(0);
    const log = await owner(async (c) => {
      await c.query("SELECT set_config('app.org_id', $1, false)", [org.id]);
      return c.query("SELECT action, object_type FROM audit_log WHERE object_id = $1", [membershipId]);
    });
    expect(log.rows.map((r) => r.action)).toContain("person.invite");
  });
});
