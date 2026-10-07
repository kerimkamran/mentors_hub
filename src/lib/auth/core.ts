/**
 * Sign-in, sessions, TOTP, consent — framework-free (no cookies/headers) so it is testable against
 * a real database. The HTTP glue lives in ./http.ts.
 *
 * Invariants: INV-5 (links never change anything by themselves; code bound to the requesting
 * browser; single use), INV-1.5 (the organisation comes from the session row), INV-8 (fail closed),
 * AC-TEN-01.2 (identical response for unknown/inactive/uninvited addresses).
 */
import { DEFAULTS, PRIVACY_NOTICE_VERSION } from "../constants";
import { decryptSecret, encryptSecret, randomCode, randomToken, safeEqualHex, sha256Hex } from "../crypto";
import { withGlobal, withOrg } from "../db";
import { enqueueSignInMail, type SignInMail } from "../jobs";
import type { Actor, Grant } from "../permissions";
import { securitySettings } from "../settings";
import { generateTotpSecret, otpauthUri, stepOf, verifyTotp } from "../totp";
import { env } from "../env";
import { audit } from "../audit";

export interface AuthDeps {
  enqueueSignInMail: (m: SignInMail) => Promise<void>;
  now: () => Date;
  /** Minimum duration of requestSignIn in ms, to equalise timing between known and unknown addresses. */
  minRequestMs: number;
}
export const defaultDeps: AuthDeps = { enqueueSignInMail, now: () => new Date(), minRequestMs: 350 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function normaliseEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL.test(e) ? e : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- rate limiting
/** Counts a hit and returns true if the bucket is now over its limit. Per identity and per browser only (C-045). */
export async function overLimit(bucket: string, limit: number, windowMinutes: number): Promise<boolean> {
  return withGlobal(async (tx) => {
    const r = await tx.query<{ hits: number }>(
      `INSERT INTO auth_rate_limit (bucket, window_start, hits)
       VALUES ($1, date_bin($2::interval, now(), TIMESTAMPTZ 'epoch'), 1)
       ON CONFLICT (bucket, window_start) DO UPDATE SET hits = auth_rate_limit.hits + 1
       RETURNING hits`,
      [bucket, `${windowMinutes} minutes`],
    );
    if (Math.random() < 0.01) await tx.query("DELETE FROM auth_rate_limit WHERE window_start < now() - interval '1 day'");
    return r.rows[0]!.hits > limit;
  });
}

// ---------------------------------------------------------------- request a sign-in
export type RequestResult = "sent" | "limited";

export async function requestSignIn(rawEmail: string, browserId: string, deps: AuthDeps = defaultDeps): Promise<RequestResult> {
  const started = Date.now();
  const email = normaliseEmail(rawEmail) ?? "invalid@invalid.invalid";
  const valid = normaliseEmail(rawEmail) !== null;
  const win = DEFAULTS.rateWindowMinutes;

  const [emailLimited, browserLimited] = [
    await overLimit(`email:${sha256Hex(email)}`, DEFAULTS.rateRequestsPerEmail, win),
    await overLimit(`browser:${sha256Hex(browserId)}`, DEFAULTS.rateRequestsPerBrowser, win),
  ];
  let result: RequestResult = "sent";
  if (emailLimited || browserLimited) {
    result = "limited";
  } else if (valid) {
    await issueChallenge(email, browserId, deps);
  } else {
    await dummyWork();
  }
  const wait = deps.minRequestMs - (Date.now() - started);
  if (wait > 0) await sleep(wait);
  return result;
}

async function dummyWork() {
  // Same shape as the real path: a domain lookup, hashing, and a random-length-free constant delay (see minRequestMs).
  await withGlobal((tx) => tx.query("SELECT organisation_id FROM organisation_domain WHERE domain = $1", ["none.invalid"]));
  sha256Hex(randomToken());
}

async function issueChallenge(email: string, browserId: string, deps: AuthDeps) {
  const domain = email.split("@")[1]!;
  const found = await withGlobal(async (tx) => {
    const d = await tx.query<{ organisation_id: string }>("SELECT organisation_id FROM organisation_domain WHERE domain = $1", [domain]);
    const orgId = d.rows[0]?.organisation_id;
    if (!orgId) return null;
    const i = await tx.query<{ id: string; locale: "en" | "az" | "ru" | null }>("SELECT id, locale FROM identity WHERE email = $1", [email]);
    const org = await tx.query<{ default_locale: "en" | "az" | "ru" }>("SELECT default_locale FROM organisation WHERE id = $1", [orgId]);
    return { orgId, identity: i.rows[0] ?? null, orgLocale: org.rows[0]!.default_locale };
  });
  if (!found || !found.identity) return dummyWork();
  const member = await withOrg(found.orgId, (tx) =>
    tx.query("SELECT 1 FROM membership WHERE identity_id = $1 AND status = 'active'", [found.identity!.id]),
  );
  if (member.rowCount === 0) return dummyWork();

  const sec = await securitySettings(found.orgId);
  const token = randomToken();
  const code = randomCode(DEFAULTS.codeLength);
  const expires = new Date(deps.now().getTime() + sec.linkLifetimeMinutes * 60_000);
  await withGlobal(async (tx) => {
    // A new request voids earlier open challenges of the same browser (one live challenge per browser).
    await tx.query("UPDATE login_challenge SET used_at = now() WHERE browser_hash = $1 AND used_at IS NULL", [sha256Hex(browserId)]);
    await tx.query(
      `INSERT INTO login_challenge (identity_id, organisation_id, token_hash, code_hash, browser_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [found.identity!.id, found.orgId, sha256Hex(token), sha256Hex(code), sha256Hex(browserId), expires],
    );
  });
  await deps.enqueueSignInMail({
    to: email,
    locale: found.identity.locale ?? found.orgLocale,
    token,
    code,
    minutes: sec.linkLifetimeMinutes,
  });
}

// ---------------------------------------------------------------- complete a sign-in
/** Read-only: lets the landing page decide what to show. Changes nothing (INV-5.1, T-INV5-01). */
export async function peekLink(token: string, browserId: string | null): Promise<"usable" | "unusable"> {
  const r = await withGlobal((tx) =>
    tx.query("SELECT browser_hash FROM login_challenge WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()", [sha256Hex(token)]),
  );
  const row = r.rows[0];
  return row && browserId && row.browser_hash === sha256Hex(browserId) ? "usable" : "unusable";
}

export interface Completed {
  sessionToken: string;
  maxAgeSeconds: number;
}

export async function completeWithLink(token: string, browserId: string, deps: AuthDeps = defaultDeps): Promise<Completed | null> {
  const used = await withGlobal((tx) =>
    tx.query<{ identity_id: string; organisation_id: string }>(
      `UPDATE login_challenge SET used_at = now()
       WHERE token_hash = $1 AND browser_hash = $2 AND used_at IS NULL AND expires_at > now()
       RETURNING identity_id, organisation_id`,
      [sha256Hex(token), sha256Hex(browserId)],
    ),
  );
  const row = used.rows[0];
  return row ? createSession(row.identity_id, row.organisation_id, deps) : null;
}

export async function completeWithCode(code: string, browserId: string, deps: AuthDeps = defaultDeps): Promise<Completed | null> {
  const bh = sha256Hex(browserId);
  const live = await withGlobal((tx) =>
    tx.query<{ id: string; code_hash: string; organisation_id: string; identity_id: string }>(
      `SELECT id, code_hash, organisation_id, identity_id FROM login_challenge
       WHERE browser_hash = $1 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [bh],
    ),
  );
  const ch = live.rows[0];
  if (!ch) return null;
  const sec = await securitySettings(ch.organisation_id);
  if (/^\d{6}$/.test(code) && safeEqualHex(ch.code_hash, sha256Hex(code))) {
    const won = await withGlobal((tx) =>
      tx.query("UPDATE login_challenge SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id", [ch.id]),
    );
    return won.rowCount ? createSession(ch.identity_id, ch.organisation_id, deps) : null;
  }
  // Wrong code: count it; void the challenge once the limit is reached (INV-5.4).
  await withGlobal((tx) =>
    tx.query(
      `UPDATE login_challenge SET failed_attempts = failed_attempts + 1,
         used_at = CASE WHEN failed_attempts + 1 >= $2 THEN now() ELSE used_at END
       WHERE id = $1`,
      [ch.id, sec.codeAttempts],
    ),
  );
  return null;
}

async function createSession(identityId: string, organisationId: string, deps: AuthDeps): Promise<Completed | null> {
  const member = await withOrg(organisationId, (tx) =>
    tx.query<{ id: string }>("SELECT id FROM membership WHERE identity_id = $1 AND status = 'active'", [identityId]),
  );
  const membershipId = member.rows[0]?.id;
  if (!membershipId) return null; // deactivated between request and click: fail closed
  const sec = await securitySettings(organisationId);
  const token = randomToken();
  const expires = new Date(deps.now().getTime() + sec.sessionAbsoluteDays * 86_400_000);
  await withGlobal((tx) =>
    tx.query(
      `INSERT INTO web_session (token_hash, identity_id, organisation_id, membership_id, expires_at, idle_minutes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sha256Hex(token), identityId, organisationId, membershipId, expires, sec.sessionIdleMinutes],
    ),
  );
  await withOrg(organisationId, (tx) =>
    audit(tx, { organisationId, actorId: membershipId, action: "auth.signin", objectType: "membership", objectId: membershipId }),
  );
  return { sessionToken: token, maxAgeSeconds: sec.sessionAbsoluteDays * 86400 };
}

// ---------------------------------------------------------------- sessions
export async function resolveSession(rawToken: string | undefined, deps: AuthDeps = defaultDeps): Promise<Actor | null> {
  if (!rawToken) return null;
  const s = await withGlobal((tx) =>
    tx.query<{
      id: string; identity_id: string; organisation_id: string; membership_id: string;
      last_seen_at: Date; expires_at: Date; totp_verified_at: Date | null; revoked_at: Date | null; idle_minutes: number | null;
    }>("SELECT * FROM web_session WHERE token_hash = $1", [sha256Hex(rawToken)]),
  );
  const row = s.rows[0];
  const now = deps.now();
  if (!row || row.revoked_at || row.expires_at <= now) return null;
  // The idle limit is the one the session was issued with (AC-TEN-04.3); older sessions fall back to the current setting.
  const idleMinutes = row.idle_minutes ?? (await securitySettings(row.organisation_id)).sessionIdleMinutes;
  if (now.getTime() - row.last_seen_at.getTime() > idleMinutes * 60_000) return null;

  if (now.getTime() - row.last_seen_at.getTime() > 60_000) {
    await withGlobal((tx) => tx.query("UPDATE web_session SET last_seen_at = $2 WHERE id = $1", [row.id, now]));
  }
  const loaded = await withOrg(row.organisation_id, async (tx) => {
    const m = await tx.query<{ status: string }>("SELECT status FROM membership WHERE id = $1", [row.membership_id]);
    if (m.rows[0]?.status !== "active") return null; // deactivated people lose access immediately
    const roles = await tx.query<{ role: Grant["role"]; scope_type: Grant["scopeType"]; scope_id: string | null }>(
      "SELECT role, scope_type, scope_id FROM role_grant WHERE membership_id = $1",
      [row.membership_id],
    );
    return roles.rows.map((r): Grant => ({ role: r.role, scopeType: r.scope_type, scopeId: r.scope_id }));
  });
  if (!loaded) return null;
  const ident = await withGlobal(async (tx) => {
    const i = await tx.query<{ locale: Actor["locale"] | null; time_zone: string | null; totp_enrolled_at: Date | null; is_platform_admin: boolean }>(
      "SELECT locale, time_zone, totp_enrolled_at, is_platform_admin FROM identity WHERE id = $1",
      [row.identity_id],
    );
    const o = await tx.query<{ default_locale: Actor["locale"]; time_zone: string }>(
      "SELECT default_locale, time_zone FROM organisation WHERE id = $1",
      [row.organisation_id],
    );
    return { i: i.rows[0]!, o: o.rows[0]! };
  });
  return {
    identityId: row.identity_id,
    membershipId: row.membership_id,
    organisationId: row.organisation_id,
    roles: loaded,
    isPlatformAdmin: ident.i.is_platform_admin,
    locale: ident.i.locale ?? ident.o.default_locale,
    timeZone: ident.i.time_zone ?? ident.o.time_zone ?? DEFAULTS.defaultTimeZone,
    totpEnrolled: ident.i.totp_enrolled_at !== null,
    totpVerified: row.totp_verified_at !== null,
    totpVerifiedAt: row.totp_verified_at,
  };
}

export async function revokeSession(rawToken: string): Promise<void> {
  await withGlobal((tx) => tx.query("UPDATE web_session SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [sha256Hex(rawToken)]));
}

// ---------------------------------------------------------------- TOTP (FR-TEN-009)
/** Starts (or repeats) enrolment for a not-yet-enrolled identity. Returns the manual key and otpauth URI. */
export async function beginTotpEnrol(actor: Actor, email: string): Promise<{ secret: string; uri: string } | null> {
  if (actor.totpEnrolled) return null;
  const secret = generateTotpSecret();
  await withGlobal((tx) =>
    tx.query("UPDATE identity SET totp_secret_enc = $2 WHERE id = $1 AND totp_enrolled_at IS NULL", [
      actor.identityId,
      encryptSecret(secret, env().SESSION_SECRET),
    ]),
  );
  return { secret, uri: otpauthUri(secret, email) };
}

/** Verifies a code (confirming enrolment on first success) and marks THIS session as TOTP-verified. One use per time-step. */
export async function confirmTotp(actor: Actor, sessionToken: string, code: string, nowMs = Date.now()): Promise<boolean> {
  const row = await withGlobal((tx) =>
    tx.query<{ totp_secret_enc: string | null }>("SELECT totp_secret_enc FROM identity WHERE id = $1", [actor.identityId]),
  );
  const enc = row.rows[0]?.totp_secret_enc;
  if (!enc) return false;
  const counter = verifyTotp(decryptSecret(enc, env().SESSION_SECRET), code, nowMs);
  if (counter === null) return false;
  const fresh = await withGlobal((tx) =>
    tx.query(
      `UPDATE identity SET totp_last_counter = $2, totp_enrolled_at = COALESCE(totp_enrolled_at, now())
       WHERE id = $1 AND (totp_last_counter IS NULL OR totp_last_counter < $2) RETURNING id`,
      [actor.identityId, counter],
    ),
  );
  if (!fresh.rowCount) return false; // replay of an already-used time-step
  await withGlobal((tx) => tx.query("UPDATE web_session SET totp_verified_at = now() WHERE token_hash = $1", [sha256Hex(sessionToken)]));
  return true;
}

/** True if the actor completed TOTP within the step-up window (for sensitive admin actions, FR-ADM-018). */
export const hasFreshStepUp = (actor: Actor, now = new Date(), minutes: number = DEFAULTS.stepUpMinutes) =>
  !!actor.totpVerifiedAt && now.getTime() - actor.totpVerifiedAt.getTime() <= minutes * 60_000;

export const totpRequired = (actor: Actor) =>
  actor.isPlatformAdmin || actor.roles.some((g) => g.role === "org_admin");

// ---------------------------------------------------------------- consent (FR-TEN-014)
export async function hasAcceptedNotice(actor: Actor): Promise<boolean> {
  const r = await withOrg(actor.organisationId, (tx) =>
    tx.query("SELECT 1 FROM consent WHERE membership_id = $1 AND scope = 'privacy_notice' AND version = $2", [actor.membershipId, PRIVACY_NOTICE_VERSION]),
  );
  return (r.rowCount ?? 0) > 0;
}

export async function recordConsent(actor: Actor, scope: "privacy_notice" | "ai_assistance" | "programme_data_sharing", version: string): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    await tx.query(
      `INSERT INTO consent (organisation_id, membership_id, scope, version) VALUES ($1, $2, $3, $4)
       ON CONFLICT (membership_id, scope, version) DO NOTHING`,
      [actor.organisationId, actor.membershipId, scope, version],
    );
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: `consent.${scope}`, objectType: "membership", objectId: actor.membershipId });
  });
}

export { stepOf };
