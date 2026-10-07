import type { Tx } from "@/lib/db";
import { can, type Actor } from "@/lib/permissions";
import type { PaletteItem, SearchSource } from "../registry";

/**
 * Programmes and people, trimmed to the actor's scope: an organisation admin searches everything; a PM only their own
 * programmes and the people taking part in them (matrix §4.11 "S (basic)"). Other roles get none of these.
 * Routes follow the admin area convention /admin/programmes/{id} and /admin/people/{id}.
 */
function pmScope(actor: Actor): { programmes: string[]; cohorts: string[] } {
  return {
    programmes: actor.roles.filter((g) => g.role === "pm" && g.scopeType === "programme" && g.scopeId).map((g) => g.scopeId!),
    cohorts: actor.roles.filter((g) => g.role === "pm" && g.scopeType === "cohort" && g.scopeId).map((g) => g.scopeId!),
  };
}
const isOrgAdmin = (a: Actor) => a.roles.some((g) => g.role === "org_admin" && g.scopeType === "org");
const isPm = (a: Actor) => a.roles.some((g) => g.role === "pm");

export const programmesSource: SearchSource = {
  id: "programmes",
  group: "programmes",
  allowed: (a) => can(a, "palette.use") && (isOrgAdmin(a) || isPm(a)),
  search: async (tx: Tx, actor: Actor, q: string, limit: number): Promise<PaletteItem[]> => {
    const all = isOrgAdmin(actor);
    const s = pmScope(actor);
    const r = await tx.query<{ id: string; name: string; type: string }>(
      `SELECT p.id, p.name, p.type FROM programme p
        WHERE strpos(mh_normalise(p.name), $1) > 0
          AND ($2::boolean OR p.id = ANY($3::uuid[]) OR EXISTS (SELECT 1 FROM cohort c WHERE c.programme_id = p.id AND c.id = ANY($4::uuid[])))
        ORDER BY p.name LIMIT $5`,
      [q, all, s.programmes, s.cohorts, limit],
    );
    return r.rows.map((x) => ({ id: `programme:${x.id}`, group: "programmes" as const, label: x.name, href: `/admin/programmes/${x.id}`, hint: x.type }));
  },
};

export const peopleSource: SearchSource = {
  id: "people",
  group: "people",
  allowed: (a) => can(a, "palette.use") && (isOrgAdmin(a) || isPm(a)),
  search: async (tx: Tx, actor: Actor, q: string, limit: number): Promise<PaletteItem[]> => {
    const all = isOrgAdmin(actor);
    const s = pmScope(actor);
    const r = await tx.query<{ id: string; display_name: string; department: string | null }>(
      `SELECT m.id, p.display_name, p.department FROM membership m
         JOIN person_profile p ON p.membership_id = m.id
        WHERE m.status = 'active' AND strpos(mh_normalise(p.display_name), $1) > 0
          AND ($2::boolean OR EXISTS (
                SELECT 1 FROM participation pt JOIN cohort c ON c.id = pt.cohort_id AND c.organisation_id = pt.organisation_id
                 WHERE pt.membership_id = m.id AND (c.programme_id = ANY($3::uuid[]) OR c.id = ANY($4::uuid[]))))
        ORDER BY p.display_name LIMIT $5`,
      [q, all, s.programmes, s.cohorts, limit],
    );
    return r.rows.map((x) => ({ id: `person:${x.id}`, group: "people" as const, label: x.display_name, href: `/admin/people/${x.id}`, hint: x.department ?? undefined }));
  },
};
