import { decryptSecret } from "../crypto";
import { withGlobal } from "../db";
import { env } from "../env";
import type { Actor } from "../permissions";
import { verifyTotp } from "../totp";

/**
 * Step-up for a sensitive change (FR-ADM-018, A6): checks a fresh authenticator code for THIS actor. One use per time-step
 * (the same replay guard as sign-in). Returns false for a missing code, a wrong code, an actor with no enrolled authenticator,
 * or a replayed code. It never throws for a bad code (callers fail closed).
 */
export async function verifyStepUpCode(actor: Actor, code: string, nowMs = Date.now()): Promise<boolean> {
  if (!actor.totpEnrolled || !/^\d{6}$/.test(code)) return false;
  const row = await withGlobal((tx) => tx.query<{ totp_secret_enc: string | null; totp_enrolled_at: Date | null }>("SELECT totp_secret_enc, totp_enrolled_at FROM identity WHERE id = $1", [actor.identityId]));
  const r = row.rows[0];
  if (!r?.totp_secret_enc || !r.totp_enrolled_at) return false;
  let counter: number | null;
  try {
    counter = verifyTotp(decryptSecret(r.totp_secret_enc, env().SESSION_SECRET), code, nowMs);
  } catch {
    return false;
  }
  if (counter === null) return false;
  const fresh = await withGlobal((tx) =>
    tx.query("UPDATE identity SET totp_last_counter = $2 WHERE id = $1 AND (totp_last_counter IS NULL OR totp_last_counter < $2) RETURNING id", [actor.identityId, counter]),
  );
  return (fresh.rowCount ?? 0) > 0;
}
