import { audit } from "@/lib/audit";
import { withOrg } from "@/lib/db";
import { authorize, NotFoundError, type Actor } from "@/lib/permissions";
import { notify } from "@/domain/notifications/notify";
import { cancelJob, enqueueInTx } from "@/domain/notifications/queue";
import { opsSettings } from "@/domain/notifications/settings";
import { inScope, recipientsInScope } from "./scope";

export const ANNOUNCEMENT_LANGS = ["en", "az", "ru"] as const;
export type AnnouncementLang = (typeof ANNOUNCEMENT_LANGS)[number];

export type AnnouncementProblem = "no_text" | "too_long" | "end_required" | "end_before_start";

/** A rejected announcement: the reason is a code the page translates (AC-ADM-18.2). Nothing is saved. */
export class AnnouncementInvalid extends Error {
  constructor(readonly problem: AnnouncementProblem, readonly max?: number) {
    super(problem);
  }
}

export interface AnnouncementInput {
  scopeType: "org" | "programme";
  programmeId?: string | null;
  texts: Partial<Record<AnnouncementLang, string>>;
  startsAt?: Date | null;
  endsAt: Date | null;
  /** "Also notify": sends a link-only email to people in scope when the announcement starts (AC-ADM-18.4). Off by default. */
  notifyByEmail?: boolean;
}

/** Validates against C-164 (length) and the mandatory end date. Pure apart from the settings read. */
export function validateAnnouncement(i: AnnouncementInput, max: number, now: Date): { texts: Record<AnnouncementLang, string | null>; startsAt: Date; endsAt: Date } {
  const texts = {} as Record<AnnouncementLang, string | null>;
  let any = false;
  for (const l of ANNOUNCEMENT_LANGS) {
    const t = (i.texts[l] ?? "").trim();
    if (t.length > max) throw new AnnouncementInvalid("too_long", max);
    texts[l] = t === "" ? null : t;
    if (t !== "") any = true;
  }
  if (!any) throw new AnnouncementInvalid("no_text");
  if (!i.endsAt || Number.isNaN(i.endsAt.getTime())) throw new AnnouncementInvalid("end_required");
  const startsAt = i.startsAt && !Number.isNaN(i.startsAt.getTime()) ? i.startsAt : now;
  if (i.endsAt.getTime() <= startsAt.getTime()) throw new AnnouncementInvalid("end_before_start");
  return { texts, startsAt, endsAt: i.endsAt };
}

/** Create or schedule an announcement. An organisation-wide post needs org admin; a PM may post to a programme in their scope. */
export async function createAnnouncement(actor: Actor, i: AnnouncementInput, now = new Date()): Promise<string> {
  if (i.scopeType === "org") authorize(actor, "announcement.post.org");
  else authorize(actor, "announcement.post.programme", { programmeId: i.programmeId ?? undefined });
  const settings = await opsSettings(actor.organisationId);
  const v = validateAnnouncement(i, settings.announcementMaxChars, now);
  return withOrg(actor.organisationId, async (tx) => {
    if (i.scopeType === "programme") {
      const p = await tx.query("SELECT 1 FROM programme WHERE id = $1", [i.programmeId]);
      if (!p.rowCount) throw new NotFoundError();
    }
    const r = await tx.query<{ id: string }>(
      `INSERT INTO announcement (organisation_id, scope_type, programme_id, text_en, text_az, text_ru, starts_at, ends_at, notify_requested, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [actor.organisationId, i.scopeType, i.scopeType === "org" ? null : i.programmeId, v.texts.en, v.texts.az, v.texts.ru, v.startsAt, v.endsAt, i.notifyByEmail === true, actor.membershipId],
    );
    const id = r.rows[0]!.id;
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "announcement.create", objectType: "announcement", objectId: id });
    if (i.notifyByEmail === true)
      await enqueueInTx(tx, { organisationId: actor.organisationId, task: "announcement.notify", payload: { announcementId: id }, runAt: v.startsAt, jobKey: `ann:${id}` });
    return id;
  });
}

/** End an announcement now. The same permission as posting it, for its own scope. */
export async function endAnnouncement(actor: Actor, id: string): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ scope_type: "org" | "programme"; programme_id: string | null; ended_at: Date | null }>(
      "SELECT scope_type, programme_id, ended_at FROM announcement WHERE id = $1 FOR UPDATE",
      [id],
    );
    const a = r.rows[0];
    if (!a) throw new NotFoundError();
    if (a.scope_type === "org") authorize(actor, "announcement.post.org");
    else authorize(actor, "announcement.post.programme", { programmeId: a.programme_id ?? undefined });
    if (a.ended_at) return;
    await tx.query("UPDATE announcement SET ended_at = now() WHERE id = $1", [id]);
    await cancelJob(tx, `ann:${id}`, actor.organisationId);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "announcement.end", objectType: "announcement", objectId: id });
  });
}

/** Hide a banner for me (it stays visible to others). Only for an announcement I am in scope of. */
export async function dismissAnnouncement(actor: Actor, id: string): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ scope_type: "org" | "programme"; programme_id: string | null }>("SELECT scope_type, programme_id FROM announcement WHERE id = $1", [id]);
    const a = r.rows[0];
    if (!a) throw new NotFoundError();
    const ok = await inScope(tx, { membershipId: actor.membershipId, roles: actor.roles, status: "active" }, { scopeType: a.scope_type, programmeId: a.programme_id });
    if (!ok) throw new NotFoundError();
    await tx.query(
      "INSERT INTO announcement_dismissal (announcement_id, membership_id, organisation_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [id, actor.membershipId, actor.organisationId],
    );
  });
}

/** Worker side of "also notify": link-only emails to people in scope, once, while the announcement is live. Returns how many were notified. */
export async function notifyAnnouncement(organisationId: string, announcementId: string): Promise<number> {
  return withOrg(organisationId, async (tx) => {
    const r = await tx.query<{ scope_type: "org" | "programme"; programme_id: string | null; ended_at: Date | null; live: boolean }>(
      "SELECT scope_type, programme_id, ended_at, (starts_at <= now() AND ends_at > now()) AS live FROM announcement WHERE id = $1",
      [announcementId],
    );
    const a = r.rows[0];
    if (!a || a.ended_at || !a.live) return 0;
    let n = 0;
    for (const m of await recipientsInScope(tx, { scopeType: a.scope_type, programmeId: a.programme_id })) {
      const res = await notify(tx, { organisationId, template: "N-086", recipientId: m, subjectId: announcementId, programmeId: a.programme_id, dedupeKey: "announce" });
      if (res.status === "created") n++;
    }
    return n;
  });
}
