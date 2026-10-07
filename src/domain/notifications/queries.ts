import { withOrg } from "@/lib/db";
import { authorize, type Actor } from "@/lib/permissions";
import { loadRecipient } from "./recipient";
import { renderInApp, messageFor } from "./render";
import { allTemplates, getTemplate, inAppCodes } from "./registry";

export interface NotificationItem {
  id: string;
  templateCode: string;
  createdAt: Date;
  read: boolean;
  /** Rendered now, in the recipient's language and time zone from the template and ids (AC-MSG-02.1); null when the recipient can no longer see the object. */
  text: string | null;
}

/** My in-app notifications, newest first. Text is rendered at read time; only ids are stored (R1). */
export async function listMyNotifications(actor: Actor, opts: { limit?: number; offset?: number } = {}): Promise<NotificationItem[]> {
  authorize(actor, "notification.read.own", { ownerMembershipId: actor.membershipId });
  const codes = inAppCodes();
  return withOrg(actor.organisationId, async (tx) => {
    const recipient = await loadRecipient(tx, actor.membershipId);
    if (!recipient) return [];
    const r = await tx.query<{ id: string; template_code: string; subject_id: string; actor_id: string | null; created_at: Date; read_at: Date | null }>(
      `SELECT id, template_code, subject_id, actor_id, created_at, read_at FROM notification
        WHERE recipient_id = $1 AND template_code = ANY($2::text[])
        ORDER BY created_at DESC, id LIMIT $3 OFFSET $4`,
      [actor.membershipId, codes, Math.min(opts.limit ?? 50, 200), opts.offset ?? 0],
    );
    const out: NotificationItem[] = [];
    for (const n of r.rows) {
      const def = getTemplate(n.template_code);
      let text: string | null = null;
      if (def) {
        const params = await def.resolve({ tx, organisationId: actor.organisationId, recipient, subjectId: n.subject_id, actorId: n.actor_id });
        if (params) text = renderInApp(def, n.subject_id, params, { locale: actor.locale, timeZone: actor.timeZone }).text;
      }
      out.push({ id: n.id, templateCode: n.template_code, createdAt: n.created_at, read: n.read_at !== null, text });
    }
    return out;
  });
}

export async function unreadCount(actor: Actor): Promise<number> {
  const r = await withOrg(actor.organisationId, (tx) =>
    tx.query<{ n: number }>("SELECT count(*)::int AS n FROM notification WHERE recipient_id = $1 AND read_at IS NULL AND template_code = ANY($2::text[])", [
      actor.membershipId,
      inAppCodes(),
    ]),
  );
  return r.rows[0]!.n;
}

/**
 * Where a notification leads. Re-checks that I may still see the object: if not, returns null and the page answers
 * "not found" (AC-MSG-02.4). Read-only.
 */
export async function openNotification(actor: Actor, id: string): Promise<string | null> {
  authorize(actor, "notification.read.own", { ownerMembershipId: actor.membershipId });
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ template_code: string; subject_id: string; actor_id: string | null }>(
      "SELECT template_code, subject_id, actor_id FROM notification WHERE id = $1 AND recipient_id = $2",
      [id, actor.membershipId],
    );
    const n = r.rows[0];
    const def = n && getTemplate(n.template_code);
    if (!n || !def) return null;
    const recipient = await loadRecipient(tx, actor.membershipId);
    if (!recipient) return null;
    const params = await def.resolve({ tx, organisationId: actor.organisationId, recipient, subjectId: n.subject_id, actorId: n.actor_id });
    return params ? def.link(n.subject_id, params) : null;
  });
}

export interface PreferenceRow {
  code: string;
  label: string;
  critical: boolean;
  emailEnabled: boolean;
}

/** Email switches for every template that has an email channel. Critical ones are listed without a switch (R8, AC-MSG-02.3). */
export async function preferencesView(actor: Actor): Promise<PreferenceRow[]> {
  authorize(actor, "notification.preference.edit.own", { ownerMembershipId: actor.membershipId });
  const prefs = await withOrg(actor.organisationId, (tx) =>
    tx.query<{ template_code: string; email_enabled: boolean }>("SELECT template_code, email_enabled FROM notification_preference WHERE membership_id = $1", [actor.membershipId]),
  );
  const off = new Set(prefs.rows.filter((p) => !p.email_enabled).map((p) => p.template_code));
  return allTemplates()
    .filter((t) => t.channels.email)
    .map((t) => ({
      code: t.code,
      label: messageFor(t, actor.locale, "subject") ?? t.name,
      critical: t.critical,
      emailEnabled: t.critical ? true : !off.has(t.code),
    }));
}
