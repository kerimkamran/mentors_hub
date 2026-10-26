import { beforeAll, describe, expect, it } from "vitest";
import { resolveSession, type AuthDeps } from "../../src/lib/auth/core";
import { InviteError, PasswordError, invitePerson, redeemInvite } from "../../src/lib/auth/invite";
import { PASSWORD_ATTEMPTS_PER_EMAIL, signInWithPassword } from "../../src/lib/auth/password-signin";
import { OWNER_URL, connect } from "./helpers";
import { actorFor, createOrg, createPerson, type TestOrg } from "./factory";

let org: TestOrg;
const deps: AuthDeps = { enqueueSignInMail: async () => undefined, now: () => new Date(), minRequestMs: 0 };
const uniq = () => Math.random().toString(36).slice(2, 10);
const browser = () => `browser-${uniq()}-${"x".repeat(32)}`;
const PW = "correct horse battery staple";

async function ownerIn<T>(orgId: string, fn: (c: Awaited<ReturnType<typeof connect>>) => Promise<T>): Promise<T> {
  const c = await connect(OWNER_URL);
  try {
    await c.query("SELECT set_config('app.org_id', $1, false)", [orgId]);
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function admin() {
  const p = await createPerson(org, { roles: [{ role: "org_admin" }] });
  return (await actorFor(org, p, { totpVerified: true })).actor;
}

/** A person invited by an administrator who has chosen their own password. */
async function enrolled(password = PW) {
  const a = await admin();
  const email = `pw-${uniq()}@${org.domain}`;
  const { membershipId, token } = await invitePerson(a, { email, name: "Pw Person" });
  const done = await redeemInvite(token, password, deps);
  return { a, email, membershipId, done: done! };
}

beforeAll(async () => {
  org = await createOrg("password");
});

describe("email + password sign-in, password chosen by the person through an admin invite link", () => {
  it("the person sets a password through the link and can then sign in with email and password", async () => {
    const { email, membershipId, done } = await enrolled();
    expect((await resolveSession(done.sessionToken))?.membershipId).toBe(membershipId);
    const again = await signInWithPassword(` ${email.toUpperCase()} `, PW, browser(), deps);
    expect(again).not.toBeNull();
    expect(again).not.toBe("limited");
    expect((await resolveSession((again as { sessionToken: string }).sessionToken))?.membershipId).toBe(membershipId);
  });

  it("stores only a salted hash, never the password", async () => {
    const { email } = await enrolled();
    const r = await ownerIn(org.id, (c) => c.query("SELECT password_hash, password_set_at FROM identity WHERE email = $1", [email]));
    expect(r.rows[0].password_hash).toMatch(/^scrypt\$v1\$/);
    expect(r.rows[0].password_hash).not.toContain(PW);
    expect(r.rows[0].password_set_at).not.toBeNull();
  });

  it("a wrong password, an unknown address, a person with no password and an unknown domain all fail the same way", async () => {
    const { email } = await enrolled();
    const noPassword = await createPerson(org);
    for (const [e, p] of [[email, "wrong password entirely"], [`nobody-${uniq()}@${org.domain}`, PW], [noPassword.email, PW], [`x@unknown-${uniq()}.example`, PW], ["not an email", PW], [email, ""]] as const)
      expect(await signInWithPassword(e, p, browser(), deps)).toBeNull();
  });

  it("a deactivated person cannot sign in even with the right password", async () => {
    const { email, membershipId } = await enrolled();
    await ownerIn(org.id, (c) => c.query("UPDATE membership SET status = 'inactive' WHERE id = $1", [membershipId]));
    expect(await signInWithPassword(email, PW, browser(), deps)).toBeNull();
  });

  it("repeated wrong attempts for one address are rate limited, then even the right password waits", async () => {
    const { email } = await enrolled();
    let last: unknown = null;
    for (let i = 0; i < PASSWORD_ATTEMPTS_PER_EMAIL + 1; i++) last = await signInWithPassword(email, "wrong password again", browser(), deps);
    expect(last).toBe("limited");
    expect(await signInWithPassword(email, PW, browser(), deps)).toBe("limited");
  });

  it("a weak or mismatching password is refused and the link is NOT used up", async () => {
    const a = await admin();
    const email = `weak-${uniq()}@${org.domain}`;
    const { token } = await invitePerson(a, { email, name: "Weak" });
    await expect(redeemInvite(token, "short", deps)).rejects.toMatchObject({ reason: "too_short" });
    await expect(redeemInvite(token, "aaaaaaaaaaaaaaaa", deps)).rejects.toBeInstanceOf(PasswordError);
    await expect(redeemInvite(token, `${email.split("@")[0]}-12345`, deps)).rejects.toMatchObject({ reason: "weak" });
    expect(await redeemInvite(token, PW, deps)).not.toBeNull();
  });

  it("a new invite link lets an existing person set a new password, and signs out their old sessions", async () => {
    const { a, email, done } = await enrolled();
    const { token } = await invitePerson(a, { email, name: "Pw Person" });
    const NEW = "another long passphrase 2026";
    const fresh = await redeemInvite(token, NEW, deps);
    expect(fresh).not.toBeNull();
    expect(await resolveSession(done.sessionToken)).toBeNull();
    expect(await signInWithPassword(email, PW, browser(), deps)).toBeNull();
    expect(await signInWithPassword(email, NEW, browser(), deps)).not.toBeNull();
  });

  it("only addresses on the organisation's registered domains can be invited", async () => {
    const a = await admin();
    await expect(invitePerson(a, { email: `out-${uniq()}@elsewhere-${uniq()}.example`, name: "Out" })).rejects.toMatchObject({ reason: "domain_not_allowed" });
    await expect(invitePerson(a, { email: `out-${uniq()}@elsewhere.example`, name: "Out" })).rejects.toBeInstanceOf(InviteError);
  });

  it("an administrator can set an initial password: the person signs in at once, and can still use the link to choose their own", async () => {
    const a = await admin();
    const email = `adm-${uniq()}@${org.domain}`;
    const { membershipId, token } = await invitePerson(a, { email, name: "Admin Set", password: PW });
    const status = await ownerIn(org.id, (c) => c.query("SELECT status FROM membership WHERE id = $1", [membershipId]));
    expect(status.rows[0].status).toBe("active");
    expect(await signInWithPassword(email, PW, browser(), deps)).not.toBeNull();
    const own = "my own passphrase for the hub";
    expect(await redeemInvite(token, own, deps)).not.toBeNull();
    expect(await signInWithPassword(email, PW, browser(), deps)).toBeNull();
    expect(await signInWithPassword(email, own, browser(), deps)).not.toBeNull();
  });

  it("an administrator-set password must meet the policy, and only administrators may set one", async () => {
    const a = await admin();
    await expect(invitePerson(a, { email: `weak-${uniq()}@${org.domain}`, name: "W", password: "short" })).rejects.toBeInstanceOf(PasswordError);
    const pm = await createPerson(org, { roles: [{ role: "pm" }] });
    const { actor } = await actorFor(org, pm, { totpVerified: true });
    await expect(invitePerson(actor, { email: `pm-${uniq()}@${org.domain}`, name: "P", password: PW })).rejects.toThrow();
  });

  it("setting a password for an existing person replaces it and signs out their sessions", async () => {
    const { a, email, done } = await enrolled();
    const NEW = "replacement passphrase 2026!";
    await invitePerson(a, { email, name: "Pw Person", password: NEW });
    expect(await resolveSession(done.sessionToken)).toBeNull();
    expect(await signInWithPassword(email, PW, browser(), deps)).toBeNull();
    expect(await signInWithPassword(email, NEW, browser(), deps)).not.toBeNull();
  });
});
