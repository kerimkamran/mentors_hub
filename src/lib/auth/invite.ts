/**
 * Invite links: invite-only access. An organisation administrator adds a person and gets back a single-use link to
 * hand to them out of band (no email server needed). Opening the link is a read-only page that asks the person to choose
 * their own password; submitting it redeems the link, stores only a hash of the password, activates the membership and
 * starts a session (INV-5.1: a GET never signs anyone in). An administrator may instead (or also) set an initial
 * password when adding the person; a new link or a new administrator-set password is how a forgotten password is reset.
 *
 * Unlike the emailed sign-in link, an invite link is NOT bound to the requesting browser (the administrator, not the
 * invitee, creates it). Protection is: 256-bit random token stored only as a hash, single use, short expiry, one live
 * link per person (a new one voids the previous), and administrators cannot invite deactivated people.
 */
import { audit } from "../audit";
import { randomToken, sha256Hex } from "../crypto";
import { withGlobal, withOrg } from "../db";
import { authorize, NotFoundError, type Actor } from "../permissions";
import { createSession, defaultDeps, normaliseEmail, type AuthDeps, type Completed } from "./core";
import { checkPassword, hashPassword, PasswordError } from "./password";

/** Starting default; a link older than this can no longer be used. */
export const INVITE_LIFETIME_DAYS = 7;

export class InviteError extends Error {
  constructor(readonly reason: "invalid_email" | "invalid_name" | "inactive" | "domain_not_allowed") {
    super(`invite refused: ${reason}`);
  }
}

/** Voids earlier unused links of the membership and stores a new one. Returns the plain token (shown once, never stored). */
export async function issueInviteLink(
  orgId: string,
  identityId: string,
  membershipId: string,
  createdBy: string | null,
  now: () => Date = () => new Date(),
): Promise<string> {
  const token = randomToken();
  const expires = new Date(now().getTime() + INVITE_LIFETIME_DAYS * 86_400_000);
  await withGlobal(async (tx) => {
    await tx.query("UPDATE invite_link SET used_at = now() WHERE membership_id = $1 AND used_at IS NULL", [membershipId]);
    await tx.query(
      `INSERT INTO invite_link (organisation_id, identity_id, membership_id, token_hash, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orgId, identityId, membershipId, sha256Hex(token), createdBy, expires],
    );
  });
  return token;
}

export interface InviteResult {
  membershipId: string;
  token: string;
}

/**
 * Administrators only (people.invite). Adds the person if new, then issues a fresh single-use link that the person can
 * use to choose their own password. Optionally the administrator also sets an initial password (people.set_password):
 * the account is then active at once and the person can sign in with it, or replace it through the link.
 */
export async function invitePerson(actor: Actor, input: { email: string; name: string; password?: string }, now: () => Date = () => new Date()): Promise<InviteResult> {
  authorize(actor, "people.invite");
  if (input.password) authorize(actor, "people.set_password");
  const email = normaliseEmail(input.email);
  if (!email) throw new InviteError("invalid_email");
  const name = input.name.trim();
  if (name.length < 1 || name.length > 200) throw new InviteError("invalid_name");

  // Only addresses on the organisation's registered domains can be invited (sign-in resolves the organisation from the domain).
  const allowed = await withGlobal((tx) =>
    tx.query("SELECT 1 FROM organisation_domain WHERE domain = $1 AND organisation_id = $2", [email.split("@")[1], actor.organisationId]),
  );
  if (!allowed.rowCount) throw new InviteError("domain_not_allowed");

  let passwordHash: string | null = null;
  if (input.password) {
    const problem = checkPassword(input.password, email);
    if (problem) throw new PasswordError(problem);
    passwordHash = await hashPassword(input.password);
  }

  const { identityId, membershipId } = await withOrg(actor.organisationId, async (tx) => {
    const i = await tx.query<{ id: string }>(
      "INSERT INTO identity (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id",
      [email],
    );
    const identity = i.rows[0]!.id;
    const existing = await tx.query<{ id: string; status: string }>("SELECT id, status FROM membership WHERE identity_id = $1 FOR UPDATE", [identity]);
    let membership: string;
    if (existing.rows[0]) {
      if (existing.rows[0].status === "inactive") throw new InviteError("inactive");
      membership = existing.rows[0].id;
    } else {
      const m = await tx.query<{ id: string }>(
        "INSERT INTO membership (organisation_id, identity_id, status, source) VALUES ($1, $2, 'invited', 'invite') RETURNING id",
        [actor.organisationId, identity],
      );
      membership = m.rows[0]!.id;
      await tx.query("INSERT INTO person_profile (membership_id, organisation_id, display_name) VALUES ($1, $2, $3)", [membership, actor.organisationId, name]);
    }
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "person.invite", objectType: "membership", objectId: membership });
    if (passwordHash) {
      await tx.query("UPDATE identity SET password_hash = $2, password_set_at = now() WHERE id = $1", [identity, passwordHash]);
      await tx.query("UPDATE membership SET status = 'active' WHERE id = $1 AND status = 'invited'", [membership]);
      await tx.query("UPDATE web_session SET revoked_at = now() WHERE identity_id = $1 AND revoked_at IS NULL", [identity]);
      await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "person.password_set_by_admin", objectType: "membership", objectId: membership });
    }
    return { identityId: identity, membershipId: membership };
  });

  const token = await issueInviteLink(actor.organisationId, identityId, membershipId, actor.membershipId, now);
  return { membershipId, token };
}

/** Read-only: lets the landing page decide what to show. Changes nothing. */
export async function peekInvite(token: string): Promise<"usable" | "unusable"> {
  const r = await withGlobal((tx) =>
    tx.query("SELECT 1 FROM invite_link WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()", [sha256Hex(token)]),
  );
  return r.rowCount ? "usable" : "unusable";
}

/**
 * Single use: the first redemption wins. The password is checked BEFORE the link is consumed, so a weak or mistyped
 * password lets the person try again with the same link. Sets the password (hash only), activates an invited person,
 * signs out their other sessions and starts a new one. Deactivated people are refused.
 */
export async function redeemInvite(token: string, password: string, deps: AuthDeps = defaultDeps): Promise<Completed | null> {
  const found = await withGlobal((tx) =>
    tx.query<{ email: string }>(
      `SELECT i.email FROM invite_link l JOIN identity i ON i.id = l.identity_id
       WHERE l.token_hash = $1 AND l.used_at IS NULL AND l.expires_at > now()`,
      [sha256Hex(token)],
    ),
  );
  if (!found.rows[0]) return null;
  const problem = checkPassword(password, found.rows[0].email);
  if (problem) throw new PasswordError(problem);
  const passwordHash = await hashPassword(password);

  const used = await withGlobal((tx) =>
    tx.query<{ identity_id: string; organisation_id: string; membership_id: string }>(
      `UPDATE invite_link SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING identity_id, organisation_id, membership_id`,
      [sha256Hex(token)],
    ),
  );
  const row = used.rows[0];
  if (!row) return null;
  const activated = await withOrg(row.organisation_id, async (tx) => {
    const r = await tx.query("UPDATE membership SET status = 'active' WHERE id = $1 AND status IN ('invited', 'active') RETURNING id", [row.membership_id]);
    if (!r.rowCount) return 0;
    await tx.query("UPDATE identity SET password_hash = $2, password_set_at = now() WHERE id = $1", [row.identity_id, passwordHash]);
    await tx.query("UPDATE web_session SET revoked_at = now() WHERE identity_id = $1 AND revoked_at IS NULL", [row.identity_id]);
    await audit(tx, { organisationId: row.organisation_id, actorId: row.membership_id, action: "auth.password_set", objectType: "membership", objectId: row.membership_id });
    return 1;
  });
  if (!activated) return null; // deactivated since the link was issued: fail closed
  return createSession(row.identity_id, row.organisation_id, deps);
}

export { NotFoundError, PasswordError };
