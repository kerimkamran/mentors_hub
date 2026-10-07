import { beforeAll, describe, expect, it } from "vitest";
import { completeWithCode, completeWithLink, confirmTotp, beginTotpEnrol, hasAcceptedNotice, peekLink, recordConsent, requestSignIn, resolveSession, revokeSession, type AuthDeps } from "../../src/lib/auth/core";
import { sha256Hex } from "../../src/lib/crypto";
import { PRIVACY_NOTICE_VERSION } from "../../src/lib/constants";
import { base32Decode, totpAt } from "../../src/lib/totp";
import { decryptSecret } from "../../src/lib/crypto";
import type { SignInMail } from "../../src/lib/jobs";
import { OWNER_URL, connect, ownerOrg } from "./helpers";
import { actorFor, createOrg, createPerson, type TestOrg, type TestPerson } from "./factory";

let org: TestOrg;
let alice: TestPerson;
let inactive: TestPerson;
let invited: TestPerson;
const mails: SignInMail[] = [];
const deps = (over: Partial<AuthDeps> = {}): AuthDeps => ({ enqueueSignInMail: async (m) => void mails.push(m), now: () => new Date(), minRequestMs: 0, ...over });
const lastMail = (to: string) => [...mails].reverse().find((m) => m.to === to)!;
const browser = () => `browser-${Math.random().toString(36).slice(2)}-${"x".repeat(32)}`;

async function owner<T>(fn: (c: Awaited<ReturnType<typeof connect>>) => Promise<T>): Promise<T> {
  const c = await connect(OWNER_URL);
  try { return await fn(c); } finally { await c.end(); }
}

beforeAll(async () => {
  org = await createOrg("auth");
  alice = await createPerson(org, { name: "Alice" });
  inactive = await createPerson(org, { status: "inactive" });
  invited = await createPerson(org, { status: "invited" });
});

describe("US-TEN-01 · sign in with an emailed link", () => {
  it("AC-TEN-01.1 · an active person gets one email with a link token and a 6-digit code", async () => {
    const b = browser();
    expect(await requestSignIn(alice.email.toUpperCase(), b, deps())).toBe("sent");
    const m = lastMail(alice.email);
    expect(m.code).toMatch(/^\d{6}$/);
    expect(m.token.length).toBeGreaterThan(30);
    expect(m.minutes).toBe(15);
  });

  it("AC-TEN-01.2 · unknown, inactive and not-invited addresses get the same response and no email; timing class is equal", async () => {
    const before = mails.length;
    const timing: number[] = [];
    for (const email of ["nobody@" + org.domain, inactive.email, invited.email, "x@unknown-domain.example", "not an email"]) {
      const t0 = Date.now();
      expect(await requestSignIn(email, browser(), deps({ minRequestMs: 120 }))).toBe("sent");
      timing.push(Date.now() - t0);
    }
    expect(mails.length).toBe(before);
    const t0 = Date.now();
    await requestSignIn(alice.email, browser(), deps({ minRequestMs: 120 }));
    timing.push(Date.now() - t0);
    expect(Math.max(...timing) - Math.min(...timing)).toBeLessThan(100); // all padded to the same class
  });

  it("AC-TEN-01.3 / T-INV5-01 · opening the link (a mail scanner's GET) changes nothing; only the POST completes", async () => {
    const b = browser();
    await requestSignIn(alice.email, b, deps());
    const m = lastMail(alice.email);
    const snapshot = async () => owner((c) => c.query("SELECT (SELECT count(*) FROM web_session)::int AS s, (SELECT count(*) FROM login_challenge WHERE used_at IS NOT NULL AND token_hash = $1)::int AS u", [sha256Hex(m.token)]));
    const before = await snapshot();
    for (let i = 0; i < 3; i++) expect(await peekLink(m.token, null)).toBe("unusable"); // scanner: no cookie
    expect(await peekLink(m.token, b)).toBe("usable");
    expect((await snapshot()).rows[0]).toEqual(before.rows[0]);
    expect(await completeWithLink(m.token, b, deps())).not.toBeNull();
  });

  it("AC-TEN-01.4 / T-INV5-02,03 · the code and the link work only in the browser that requested them", async () => {
    const a = browser(), other = browser();
    await requestSignIn(alice.email, a, deps());
    const m = lastMail(alice.email);
    expect(await completeWithCode(m.code, other, deps())).toBeNull();
    expect(await completeWithLink(m.token, other, deps())).toBeNull();
    const ok = await completeWithCode(m.code, a, deps());
    expect(ok?.sessionToken).toBeTruthy();
  });

  it("AC-TEN-01.5 / T-INV5-04 · expired, reused and over-attempted credentials are rejected", async () => {
    // reuse
    const b1 = browser();
    await requestSignIn(alice.email, b1, deps());
    const m1 = lastMail(alice.email);
    expect(await completeWithCode(m1.code, b1, deps())).not.toBeNull();
    expect(await completeWithCode(m1.code, b1, deps())).toBeNull();
    expect(await completeWithLink(m1.token, b1, deps())).toBeNull();
    // expiry
    const b2 = browser();
    await requestSignIn(alice.email, b2, deps());
    const m2 = lastMail(alice.email);
    await owner((c) => c.query("UPDATE login_challenge SET expires_at = now() - interval '1 minute' WHERE token_hash = $1", [sha256Hex(m2.token)]));
    expect(await completeWithCode(m2.code, b2, deps())).toBeNull();
    expect(await completeWithLink(m2.token, b2, deps())).toBeNull();
    // too many wrong codes void the challenge even if the right code follows (C-042)
    const b3 = browser();
    await requestSignIn(alice.email, b3, deps());
    const m3 = lastMail(alice.email);
    const wrong = m3.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect(await completeWithCode(wrong, b3, deps())).toBeNull();
    expect(await completeWithCode(m3.code, b3, deps())).toBeNull();
    expect(await completeWithLink(m3.token, b3, deps())).toBeNull();
  });

  it("a new request voids the browser's earlier link (one live challenge per browser)", async () => {
    const b = browser();
    await requestSignIn(alice.email, b, deps());
    const first = lastMail(alice.email);
    await requestSignIn(alice.email, b, deps());
    expect(await completeWithLink(first.token, b, deps())).toBeNull();
  });

  it("per-email request limit applies silently and uniformly (C-046)", async () => {
    const who = await createPerson(org);
    const results: string[] = [];
    for (let i = 0; i < 7; i++) results.push(await requestSignIn(who.email, browser(), deps()));
    expect(results.slice(0, 5)).toEqual(Array(5).fill("sent"));
    expect(results.slice(5)).toEqual(["limited", "limited"]);
  });

  it("AC-TEN-01.6 / C-045 · 100 colleagues behind one office address can all sign in", async () => {
    const people: TestPerson[] = [];
    for (let i = 0; i < 100; i++) people.push(await createPerson(org));
    const before = mails.length;
    const results = [];
    for (const p of people) results.push(await requestSignIn(p.email, browser(), deps())); // no per-IP bucket exists
    expect(results.every((r) => r === "sent")).toBe(true);
    expect(mails.length - before).toBe(100);
  }, 120000);
});

describe("Sessions (INV-1.5, FR-TEN-005)", () => {
  it("the organisation and roles come from the session row; a revoked session stops working", async () => {
    const p = await createPerson(org, { roles: [{ role: "pm", scopeType: "programme", scopeId: "00000000-0000-0000-0000-0000000000aa" }] });
    const { actor, token } = await actorFor(org, p);
    expect(actor.organisationId).toBe(org.id);
    expect(actor.roles).toEqual([{ role: "pm", scopeType: "programme", scopeId: "00000000-0000-0000-0000-0000000000aa" }]);
    await revokeSession(token);
    expect(await resolveSession(token)).toBeNull();
  });
  it("absolute expiry, idle timeout and deactivation end access immediately", async () => {
    const p = await createPerson(org);
    const { token } = await actorFor(org, p);
    expect(await resolveSession(token, deps({ now: () => new Date(Date.now() + 9 * 3600_000) }))).toBeNull(); // 9 h idle > 8 h
    expect(await resolveSession(token, deps({ now: () => new Date(Date.now() + 31 * 86400_000) }))).toBeNull();
    await ownerOrg(org.id, (c) => c.query("UPDATE membership SET status = 'inactive' WHERE id = $1", [p.membershipId]));
    expect(await resolveSession(token)).toBeNull();
  });
  it("garbage or missing tokens resolve to nobody", async () => {
    expect(await resolveSession(undefined)).toBeNull();
    expect(await resolveSession("not-a-token")).toBeNull();
  });
  it("sign-in is audited by id without free text", async () => {
    const rows = await ownerOrg(org.id, (c) => c.query("SELECT action, object_type FROM audit_log WHERE action = 'auth.signin' LIMIT 1"));
    expect(rows.rows[0]).toEqual({ action: "auth.signin", object_type: "membership" });
  });
});

describe("FR-TEN-009 · administrator TOTP", () => {
  it("enrol, confirm, mark the session verified, and refuse a replayed time-step", async () => {
    const admin = await createPerson(org, { roles: [{ role: "org_admin" }] });
    const { actor, token } = await actorFor(org, admin);
    expect(actor.totpEnrolled).toBe(false);
    const enrol = await beginTotpEnrol(actor, admin.email);
    expect(enrol?.secret).toMatch(/^[A-Z2-7]{32}$/);
    // The stored secret is encrypted at rest.
    const stored = await owner((c) => c.query("SELECT totp_secret_enc FROM identity WHERE id = $1", [admin.identityId]));
    expect(stored.rows[0].totp_secret_enc).not.toContain(enrol!.secret);
    const now = Date.now();
    const code = totpAt(enrol!.secret, Math.floor(now / 30000));
    expect(await confirmTotp(actor, token, "000000", now)).toBe(false);
    expect(await confirmTotp(actor, token, code, now)).toBe(true);
    const after = await resolveSession(token);
    expect(after?.totpVerified).toBe(true);
    expect(after?.totpEnrolled).toBe(true);
    expect(await confirmTotp(after!, token, code, now)).toBe(false); // replay
    expect(await beginTotpEnrol(after!, admin.email)).toBeNull(); // cannot re-enrol over an active secret
  });
});

describe("US-TEN-03 · privacy notice and consent", () => {
  it("AC-TEN-03.1/2 · the notice must be accepted for the current version; acceptance is stored with the version", async () => {
    const p = await createPerson(org);
    const { actor } = await actorFor(org, p);
    expect(await hasAcceptedNotice(actor)).toBe(false);
    await recordConsent(actor, "privacy_notice", "v0");
    expect(await hasAcceptedNotice(actor)).toBe(false); // an older version does not count
    await recordConsent(actor, "privacy_notice", PRIVACY_NOTICE_VERSION);
    expect(await hasAcceptedNotice(actor)).toBe(true);
    const v = await ownerOrg(org.id, (c) => c.query("SELECT version FROM consent WHERE membership_id = $1 ORDER BY version", [p.membershipId]));
    expect(v.rows.map((r) => r.version)).toEqual(["v0", PRIVACY_NOTICE_VERSION]);
  });
  it("AC-TEN-03.4 · optional AI consent is not implied by accepting the notice", async () => {
    const p = await createPerson(org);
    const { actor } = await actorFor(org, p);
    await recordConsent(actor, "privacy_notice", PRIVACY_NOTICE_VERSION);
    const r = await ownerOrg(org.id, (c) => c.query("SELECT count(*)::int AS n FROM consent WHERE membership_id = $1 AND scope = 'ai_assistance'", [p.membershipId]));
    expect(r.rows[0].n).toBe(0);
  });
});
