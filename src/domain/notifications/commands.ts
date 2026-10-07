import { withOrg } from "@/lib/db";
import { authorize, NotFoundError, type Actor } from "@/lib/permissions";
import { getTemplate } from "./registry";

/** Marks one of MY notifications read. Someone else's id is "not found". */
export async function markRead(actor: Actor, notificationId: string): Promise<void> {
  authorize(actor, "notification.read.own", { ownerMembershipId: actor.membershipId });
  await withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query("SELECT 1 FROM notification WHERE id = $1 AND recipient_id = $2", [notificationId, actor.membershipId]);
    if (!r.rowCount) throw new NotFoundError();
    await tx.query("UPDATE notification SET read_at = now() WHERE id = $1 AND read_at IS NULL", [notificationId]);
  });
}

export async function markAllRead(actor: Actor): Promise<number> {
  authorize(actor, "notification.read.own", { ownerMembershipId: actor.membershipId });
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query("UPDATE notification SET read_at = now() WHERE recipient_id = $1 AND read_at IS NULL", [actor.membershipId]);
    return r.rowCount ?? 0;
  });
}

export class CriticalNotSwitchable extends Error {
  constructor() {
    super("critical notifications cannot be switched off");
  }
}

/**
 * Switch the EMAIL for one non-critical template on or off for me. The in-app item is always kept (AC-MSG-02.2).
 * A critical template refuses the switch on the server too, not only in the UI (AC-MSG-02.3, R8).
 */
export async function setEmailPreference(actor: Actor, templateCode: string, enabled: boolean): Promise<void> {
  authorize(actor, "notification.preference.edit.own", { ownerMembershipId: actor.membershipId });
  const def = getTemplate(templateCode);
  if (!def || !def.channels.email) throw new NotFoundError();
  if (def.critical) throw new CriticalNotSwitchable();
  await withOrg(actor.organisationId, (tx) =>
    tx.query(
      `INSERT INTO notification_preference (organisation_id, membership_id, template_code, email_enabled) VALUES ($1, $2, $3, $4)
       ON CONFLICT (membership_id, template_code) DO UPDATE SET email_enabled = EXCLUDED.email_enabled, updated_at = now()`,
      [actor.organisationId, actor.membershipId, templateCode, enabled],
    ),
  );
}
