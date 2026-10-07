/**
 * Who may read what: facts about a viewer and about profile owners, computed from the database (never from the request),
 * then fed to the pure rules in ./visibility.ts.
 */
import type { Tx } from "@/lib/db";
import type { ProfileDeps } from "./deps";
import { VISIBILITY_FIELDS, type VisibilityField } from "./constants";
import { canView, effectiveLevels, type LevelMap, type ViewContext } from "./visibility";

export interface ViewerFacts {
  membershipId: string;
  /** Programmes where the viewer is an enrolled mentee or team member. */
  menteeProgrammes: Set<string>;
  /** Programmes where the viewer is an enrolled AND approved mentor. */
  approvedMentorProgrammes: Set<string>;
  /** People linked to the viewer by an active or paused relationship, a request or a proposal. */
  linked: Set<string>;
}

export interface OwnerFacts {
  membershipId: string;
  mentorProgrammes: Set<string>;
  menteeProgrammes: Set<string>;
  levels: LevelMap;
}

interface PartRow { membership_id: string; programme_id: string; kind: "mentor" | "mentee" | "team_member" }

async function participations(tx: Tx, ids: string[]): Promise<PartRow[]> {
  const r = await tx.query<PartRow>(
    `SELECT p.membership_id, c.programme_id, p.kind
       FROM participation p JOIN cohort c ON c.id = p.cohort_id AND c.organisation_id = p.organisation_id
      WHERE p.membership_id = ANY($1::uuid[]) AND p.status = 'enrolled'`,
    [ids],
  );
  return r.rows;
}

export async function loadViewerFacts(tx: Tx, membershipId: string, deps: ProfileDeps): Promise<ViewerFacts> {
  const parts = await participations(tx, [membershipId]);
  const menteeProgrammes = new Set(parts.filter((p) => p.kind !== "mentor").map((p) => p.programme_id));
  const approved = new Set<string>();
  for (const pid of new Set(parts.filter((p) => p.kind === "mentor").map((p) => p.programme_id)))
    if ((await deps.getMentorStatus(tx, membershipId, pid)).approved) approved.add(pid);
  const rel = await tx.query<{ other: string }>(
    `SELECT DISTINCT p2.membership_id AS other
       FROM relationship_member m1
       JOIN participation p1 ON p1.id = m1.participation_id AND p1.organisation_id = m1.organisation_id AND p1.membership_id = $1
       JOIN relationship r ON r.id = m1.relationship_id AND r.organisation_id = m1.organisation_id AND r.status IN ('active', 'paused')
       JOIN relationship_member m2 ON m2.relationship_id = r.id AND m2.organisation_id = r.organisation_id
       JOIN participation p2 ON p2.id = m2.participation_id AND p2.organisation_id = m2.organisation_id
      WHERE p2.membership_id <> $1`,
    [membershipId],
  );
  const linked = new Set(rel.rows.map((x) => x.other));
  for (const x of await deps.requestPartners(tx, membershipId)) linked.add(x);
  return { membershipId, menteeProgrammes, approvedMentorProgrammes: approved, linked };
}

export async function loadOwnerFacts(tx: Tx, ownerIds: string[]): Promise<Map<string, OwnerFacts>> {
  const out = new Map<string, OwnerFacts>();
  if (ownerIds.length === 0) return out;
  const parts = await participations(tx, ownerIds);
  const vis = await tx.query<{ membership_id: string; field: string; level: string }>(
    "SELECT membership_id, field, level FROM profile_field_visibility WHERE membership_id = ANY($1::uuid[])",
    [ownerIds],
  );
  for (const id of ownerIds) {
    const stored: Record<string, string> = {};
    for (const v of vis.rows) if (v.membership_id === id) stored[v.field] = v.level;
    out.set(id, {
      membershipId: id,
      mentorProgrammes: new Set(parts.filter((p) => p.membership_id === id && p.kind === "mentor").map((p) => p.programme_id)),
      menteeProgrammes: new Set(parts.filter((p) => p.membership_id === id && p.kind !== "mentor").map((p) => p.programme_id)),
      levels: effectiveLevels(stored),
    });
  }
  return out;
}

const intersects = (a: Set<string>, b: Set<string>) => [...a].some((x) => b.has(x));

export function viewContext(viewer: ViewerFacts, owner: OwnerFacts): ViewContext {
  return {
    isOwner: viewer.membershipId === owner.membershipId,
    // mentee-owned fields are read by approved mentors; mentor-owned fields by mentees of the same programme
    counterpartInSharedProgramme:
      intersects(owner.menteeProgrammes, viewer.approvedMentorProgrammes) || intersects(owner.mentorProgrammes, viewer.menteeProgrammes),
    hasRequestOrRelationship: viewer.linked.has(owner.membershipId),
  };
}

export function visibleFields(viewer: ViewerFacts, owner: OwnerFacts): Set<VisibilityField> {
  const ctx = viewContext(viewer, owner);
  return new Set(VISIBILITY_FIELDS.filter((f) => canView(owner.levels[f], ctx)));
}

/** True when either person has blocked the other (neither may see the other, C-081). */
export async function isBlockedEitherWay(tx: Tx, a: string, b: string): Promise<boolean> {
  const r = await tx.query(
    "SELECT 1 FROM block WHERE (blocker_membership_id = $1 AND blocked_membership_id = $2) OR (blocker_membership_id = $2 AND blocked_membership_id = $1) LIMIT 1",
    [a, b],
  );
  return (r.rowCount ?? 0) > 0;
}
