import { withOrg } from "@/lib/db";
import { authorize, can, NotFoundError, type Actor } from "@/lib/permissions";
import { inScope } from "./scope";

export type AnnouncementStatus = "scheduled" | "active" | "ended";

interface Row {
  id: string;
  scope_type: "org" | "programme";
  programme_id: string | null;
  text_en: string | null;
  text_az: string | null;
  text_ru: string | null;
  starts_at: Date;
  ends_at: Date;
  ended_at: Date | null;
  notify_requested: boolean;
  author: string | null;
  programme_name: string | null;
}

export const statusOf = (r: Pick<Row, "starts_at" | "ends_at" | "ended_at">, now: Date): AnnouncementStatus =>
  r.ended_at !== null || r.ends_at.getTime() <= now.getTime() ? "ended" : r.starts_at.getTime() > now.getTime() ? "scheduled" : "active";

/** The text in the reader's language, falling back to another language the author provided. */
export const pickText = (r: Pick<Row, "text_en" | "text_az" | "text_ru">, locale: "en" | "az" | "ru"): string =>
  (r[`text_${locale}` as const] ?? r.text_en ?? r.text_az ?? r.text_ru ?? "");

export interface AnnouncementListItem {
  id: string;
  scopeType: "org" | "programme";
  programmeName: string | null;
  snippet: string;
  startsAt: Date;
  endsAt: Date;
  status: AnnouncementStatus;
  author: string | null;
  notifyRequested: boolean;
  languages: ("en" | "az" | "ru")[];
}

/** Announcements an admin or PM manages. A PM sees only announcements of programmes in their own scope. */
export async function listAnnouncements(actor: Actor, now = new Date()): Promise<AnnouncementListItem[]> {
  authorize(actor, "announcement.list");
  const rows = await withOrg(actor.organisationId, (tx) =>
    tx.query<Row>(
      `SELECT a.id, a.scope_type, a.programme_id, a.text_en, a.text_az, a.text_ru, a.starts_at, a.ends_at, a.ended_at, a.notify_requested,
              p.display_name AS author, pr.name AS programme_name
         FROM announcement a
         LEFT JOIN person_profile p ON p.membership_id = a.created_by
         LEFT JOIN programme pr ON pr.id = a.programme_id
        ORDER BY a.starts_at DESC, a.id LIMIT 200`,
    ),
  );
  return rows.rows
    .filter((r) => (r.scope_type === "org" ? can(actor, "announcement.post.org") : can(actor, "announcement.post.programme", { programmeId: r.programme_id ?? undefined })))
    .map((r) => ({
      id: r.id,
      scopeType: r.scope_type,
      programmeName: r.programme_name,
      snippet: pickText(r, actor.locale).slice(0, 80),
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      status: statusOf(r, now),
      author: r.author,
      notifyRequested: r.notify_requested,
      languages: (["en", "az", "ru"] as const).filter((l) => r[`text_${l}` as const] !== null),
    }));
}

export interface Banner {
  id: string;
  text: string;
}

/** Active, in-scope, not-dismissed announcements for the current person, in their language (AC-ADM-18.3). */
export async function activeBanners(actor: Actor, now = new Date()): Promise<Banner[]> {
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<Row>(
      `SELECT a.id, a.scope_type, a.programme_id, a.text_en, a.text_az, a.text_ru, a.starts_at, a.ends_at, a.ended_at, a.notify_requested,
              NULL::text AS author, NULL::text AS programme_name
         FROM announcement a
        WHERE a.starts_at <= $1 AND a.ends_at > $1 AND a.ended_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM announcement_dismissal d WHERE d.announcement_id = a.id AND d.membership_id = $2)
        ORDER BY a.starts_at DESC, a.id LIMIT 5`,
      [now, actor.membershipId],
    );
    const out: Banner[] = [];
    for (const a of r.rows) {
      if (await inScope(tx, { membershipId: actor.membershipId, roles: actor.roles, status: "active" }, { scopeType: a.scope_type, programmeId: a.programme_id }))
        out.push({ id: a.id, text: pickText(a, actor.locale) });
    }
    return out;
  });
}

/** The full announcement page for someone in its scope. Out of scope (or missing) is "not found". */
export async function readAnnouncement(actor: Actor, id: string, now = new Date()): Promise<{ id: string; text: string; status: AnnouncementStatus; endsAt: Date }> {
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<Row>(
      `SELECT a.id, a.scope_type, a.programme_id, a.text_en, a.text_az, a.text_ru, a.starts_at, a.ends_at, a.ended_at, a.notify_requested,
              NULL::text AS author, NULL::text AS programme_name FROM announcement a WHERE a.id = $1`,
      [id],
    );
    const a = r.rows[0];
    if (!a) throw new NotFoundError();
    if (!(await inScope(tx, { membershipId: actor.membershipId, roles: actor.roles, status: "active" }, { scopeType: a.scope_type, programmeId: a.programme_id }))) throw new NotFoundError();
    if (a.starts_at.getTime() > now.getTime()) throw new NotFoundError(); // not published yet
    return { id: a.id, text: pickText(a, actor.locale), status: statusOf(a, now), endsAt: a.ends_at };
  });
}
