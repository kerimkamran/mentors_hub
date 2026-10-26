/**
 * Email + password sign-in. Every failure looks the same (wrong password, unknown address, no password set, deactivated
 * person) and costs the same time, so the response never reveals whether an address exists (FR-TEN-006).
 * Attempts are limited per address and per browser, never per IP (C-045).
 */
import { sha256Hex } from "../crypto";
import { withGlobal, withOrg } from "../db";
import { DEFAULTS } from "../constants";
import { createSession, defaultDeps, normaliseEmail, overLimit, type AuthDeps, type Completed } from "./core";
import { verifyAgainstDummy, verifyPassword } from "./password";

/** Starting defaults: 10 attempts per address and 40 per browser in each window. */
export const PASSWORD_ATTEMPTS_PER_EMAIL = 10;
export const PASSWORD_ATTEMPTS_PER_BROWSER = 40;

export type PasswordSignInResult = Completed | "limited" | null;

export async function signInWithPassword(rawEmail: string, password: string, browserId: string, deps: AuthDeps = defaultDeps): Promise<PasswordSignInResult> {
  const email = normaliseEmail(rawEmail);
  const win = DEFAULTS.rateWindowMinutes;
  const limited = [
    await overLimit(`pw-email:${sha256Hex(email ?? "invalid")}`, PASSWORD_ATTEMPTS_PER_EMAIL, win),
    await overLimit(`pw-browser:${sha256Hex(browserId)}`, PASSWORD_ATTEMPTS_PER_BROWSER, win),
  ];
  if (limited[0] || limited[1]) return "limited";
  if (!email || password.length === 0 || password.length > 1024) return verifyAgainstDummy(password).then(() => null);

  const found = await withGlobal(async (tx) => {
    const d = await tx.query<{ organisation_id: string }>("SELECT organisation_id FROM organisation_domain WHERE domain = $1", [email.split("@")[1]]);
    const orgId = d.rows[0]?.organisation_id;
    if (!orgId) return null;
    const i = await tx.query<{ id: string; password_hash: string | null }>("SELECT id, password_hash FROM identity WHERE email = $1", [email]);
    return i.rows[0] ? { orgId, identityId: i.rows[0].id, hash: i.rows[0].password_hash } : null;
  });
  if (!found || !found.hash) return verifyAgainstDummy(password).then(() => null);
  const ok = await verifyPassword(password, found.hash);
  if (!ok) return null;
  const member = await withOrg(found.orgId, (tx) => tx.query("SELECT 1 FROM membership WHERE identity_id = $1 AND status = 'active'", [found.identityId]));
  if (!member.rowCount) return null;
  return createSession(found.identityId, found.orgId, deps);
}
