import type { Tx } from "@/lib/db";
import { isProgrammeParticipant, isProgrammeStaff } from "@/domain/notifications/visibility";
import type { Recipient } from "@/domain/notifications/types";

export interface AnnouncementScope {
  scopeType: "org" | "programme";
  programmeId: string | null;
}

/** Who is "in scope" of an announcement: the whole organisation, or people taking part in / running the programme (AC-ADM-18.3). */
export async function inScope(tx: Tx, who: Pick<Recipient, "membershipId" | "roles" | "status">, a: AnnouncementScope): Promise<boolean> {
  if (who.status !== "active") return false;
  if (a.scopeType === "org") return true;
  if (!a.programmeId) return false;
  return (await isProgrammeParticipant(tx, who.membershipId, a.programmeId)) || (await isProgrammeStaff(tx, who as Recipient, a.programmeId));
}

/** Membership ids to notify when an author chooses "also notify" (AC-ADM-18.4): active members in scope. */
export async function recipientsInScope(tx: Tx, a: AnnouncementScope): Promise<string[]> {
  if (a.scopeType === "org") {
    const r = await tx.query<{ id: string }>("SELECT id FROM membership WHERE status = 'active'");
    return r.rows.map((x) => x.id);
  }
  const r = await tx.query<{ id: string }>(
    `SELECT DISTINCT m.id FROM membership m
      WHERE m.status = 'active' AND (
        EXISTS (SELECT 1 FROM participation p JOIN cohort c ON c.id = p.cohort_id AND c.organisation_id = p.organisation_id
                 WHERE p.membership_id = m.id AND c.programme_id = $1 AND p.status <> 'withdrawn')
        OR EXISTS (SELECT 1 FROM role_grant g WHERE g.membership_id = m.id AND g.role = 'pm'
                    AND (g.scope_type = 'org' OR (g.scope_type = 'programme' AND g.scope_id = $1)
                         OR (g.scope_type = 'cohort' AND g.scope_id IN (SELECT id FROM cohort WHERE programme_id = $1))))
        OR EXISTS (SELECT 1 FROM role_grant g WHERE g.membership_id = m.id AND g.role = 'org_admin' AND g.scope_type = 'org'))`,
    [a.programmeId],
  );
  return r.rows.map((x) => x.id);
}
