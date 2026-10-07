import type { Tx } from "@/lib/db";
import type { Actor, Grant } from "@/lib/permissions";
import type { Recipient } from "./types";

/** Loads the recipient from the database (membership, identity, roles). Returns null if they are not in this organisation. */
export async function loadRecipient(tx: Tx, membershipId: string): Promise<Recipient | null> {
  const r = await tx.query<{
    status: Recipient["status"]; identity_id: string; email: string; locale: Recipient["locale"] | null; time_zone: string | null;
    is_platform_admin: boolean; default_locale: Recipient["locale"]; org_tz: string;
  }>(
    `SELECT m.status, i.id AS identity_id, i.email, i.locale, i.time_zone, i.is_platform_admin,
            o.default_locale, o.time_zone AS org_tz
       FROM membership m
       JOIN identity i ON i.id = m.identity_id
       JOIN organisation o ON o.id = m.organisation_id
      WHERE m.id = $1`,
    [membershipId],
  );
  const row = r.rows[0];
  if (!row) return null;
  const roles = await tx.query<{ role: Grant["role"]; scope_type: Grant["scopeType"]; scope_id: string | null }>(
    "SELECT role, scope_type, scope_id FROM role_grant WHERE membership_id = $1",
    [membershipId],
  );
  return {
    membershipId,
    identityId: row.identity_id,
    email: row.email,
    locale: row.locale ?? row.default_locale,
    timeZone: row.time_zone ?? row.org_tz,
    roles: roles.rows.map((g) => ({ role: g.role, scopeType: g.scope_type, scopeId: g.scope_id })),
    isPlatformAdmin: row.is_platform_admin,
    status: row.status,
  };
}

/** The recipient as an Actor so templates can ask the one permission function whether they may see an object (R6). */
export function recipientActor(organisationId: string, r: Recipient): Actor {
  return {
    identityId: r.identityId,
    membershipId: r.membershipId,
    organisationId,
    roles: r.roles,
    isPlatformAdmin: r.isPlatformAdmin,
    locale: r.locale,
    timeZone: r.timeZone,
    totpEnrolled: false,
    totpVerified: false,
    totpVerifiedAt: null,
  };
}
