import type { Locale } from "@/lib/constants";
import { withOrg, type Tx } from "@/lib/db";
import { authorize, NotFoundError, type Actor } from "@/lib/permissions";
import { isUuid } from "../profiles/errors";
import type { VisibilityLevel } from "../profiles/constants";
import { engineCanRead } from "../profiles/visibility";
import { getTopicRefs, type TopicRef } from "../taxonomy/queries";

export interface GoalView {
  id: string;
  programmeId: string;
  title: string;
  state: "draft" | "active" | "achieved" | "dropped";
  primary: boolean;
  visibility: VisibilityLevel;
  tags: TopicRef[];
}

/** Open programmes in which I take part as a mentee (where US-GOL-01 applies). */
export async function myOpenProgrammes(actor: Actor): Promise<{ id: string; name: string }[]> {
  authorize(actor, "goal.read.own", { ownerMembershipId: actor.membershipId });
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ id: string; name: string }>(
      `SELECT DISTINCT pr.id, pr.name FROM programme pr JOIN cohort c ON c.programme_id = pr.id AND c.organisation_id = pr.organisation_id
         JOIN participation p ON p.cohort_id = c.id AND p.organisation_id = c.organisation_id
        WHERE pr.type = 'open' AND p.membership_id = $1 AND p.kind = 'mentee' AND p.status <> 'withdrawn' ORDER BY pr.name`,
      [actor.membershipId],
    );
    return r.rows;
  });
}

async function withTags(tx: Tx, rows: { id: string; programme_id: string; title: string; state: GoalView["state"]; is_primary: boolean; visibility: VisibilityLevel }[], locale: Locale): Promise<GoalView[]> {
  if (rows.length === 0) return [];
  const tg = await tx.query<{ goal_id: string; topic_id: string }>("SELECT goal_id, topic_id FROM goal_tag WHERE goal_id = ANY($1::uuid[])", [rows.map((r) => r.id)]);
  const refs = new Map((await getTopicRefs(tx, [...new Set(tg.rows.map((t) => t.topic_id))], locale)).map((r) => [r.id, r]));
  return rows.map((r) => ({
    id: r.id, programmeId: r.programme_id, title: r.title, state: r.state, primary: r.is_primary, visibility: r.visibility,
    tags: tg.rows.filter((t) => t.goal_id === r.id).map((t) => refs.get(t.topic_id)!).filter(Boolean),
  }));
}

/** My own goals, with titles (the owner reads everything). */
export async function listMyGoals(actor: Actor): Promise<GoalView[]> {
  authorize(actor, "goal.read.own", { ownerMembershipId: actor.membershipId });
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ id: string; programme_id: string; title: string; state: GoalView["state"]; is_primary: boolean; visibility: VisibilityLevel }>(
      "SELECT id, programme_id, title, state, is_primary, visibility FROM goal WHERE membership_id = $1 ORDER BY CASE state WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, created_at",
      [actor.membershipId],
    );
    return withTags(tx, r.rows, actor.locale);
  });
}

export interface PmGoalSummary { goalId: string; membershipId: string; state: GoalView["state"]; primary: boolean; tags: TopicRef[] }

/** PM view (matrix §4.4): tags and status only, never titles, and nothing at all for goals set to "Only me" (AC-GOL-01.3). */
export async function pmGoalSummaries(actor: Actor, programmeId: string): Promise<PmGoalSummary[]> {
  authorize(actor, "goal.read.pm_summary", { programmeId });
  if (!isUuid(programmeId)) throw new NotFoundError();
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ id: string; membership_id: string; state: GoalView["state"]; is_primary: boolean }>(
      "SELECT id, membership_id, state, is_primary FROM goal WHERE programme_id = $1 AND visibility <> 'only_me' ORDER BY created_at",
      [programmeId],
    );
    const tg = r.rows.length ? await tx.query<{ goal_id: string; topic_id: string }>("SELECT goal_id, topic_id FROM goal_tag WHERE goal_id = ANY($1::uuid[])", [r.rows.map((g) => g.id)]) : { rows: [] as { goal_id: string; topic_id: string }[] };
    const refs = new Map((await getTopicRefs(tx, [...new Set(tg.rows.map((t) => t.topic_id))], actor.locale)).map((x) => [x.id, x]));
    return r.rows.map((g) => ({ goalId: g.id, membershipId: g.membership_id, state: g.state, primary: g.is_primary, tags: tg.rows.filter((t) => t.goal_id === g.id).map((t) => refs.get(t.topic_id)!).filter(Boolean) }));
  });
}

export interface MentorGoalView {
  /** Goals the mentee chose to share in a request: title and tags (AC-GOL-01.4). */
  sharedGoals: { goalId: string; title: string; tags: TopicRef[] }[];
  /** Everything else: topic labels only, from goals the mentee made visible to matching. Never titles. */
  topicLabels: TopicRef[];
}

/**
 * What a mentor sees of a mentee's goals when opening a request (AC-GOL-01.4). `sharedGoalIds` comes from the request record
 * (slice S6) and is trusted only for goals that really belong to that mentee. Titles appear for shared goals alone.
 */
export async function mentorViewOfMenteeGoals(tx: Tx, menteeMembershipId: string, sharedGoalIds: string[], locale: Locale): Promise<MentorGoalView> {
  const shared = sharedGoalIds.filter(isUuid);
  const owned = shared.length
    ? await tx.query<{ id: string; title: string }>("SELECT id, title FROM goal WHERE membership_id = $1 AND id = ANY($2::uuid[]) AND state IN ('draft', 'active')", [menteeMembershipId, shared])
    : { rows: [] as { id: string; title: string }[] };
  const visible = await tx.query<{ id: string; visibility: VisibilityLevel }>("SELECT id, visibility FROM goal WHERE membership_id = $1 AND state = 'active'", [menteeMembershipId]);
  const labelGoalIds = visible.rows.filter((g) => engineCanRead(g.visibility)).map((g) => g.id);
  const allIds = [...new Set([...owned.rows.map((g) => g.id), ...labelGoalIds])];
  const tg = allIds.length ? await tx.query<{ goal_id: string; topic_id: string }>("SELECT goal_id, topic_id FROM goal_tag WHERE goal_id = ANY($1::uuid[])", [allIds]) : { rows: [] as { goal_id: string; topic_id: string }[] };
  const refs = new Map((await getTopicRefs(tx, [...new Set(tg.rows.map((t) => t.topic_id))], locale)).map((x) => [x.id, x]));
  const tagsOf = (id: string) => tg.rows.filter((t) => t.goal_id === id).map((t) => refs.get(t.topic_id)!).filter(Boolean);
  const topicLabels = new Map<string, TopicRef>();
  for (const id of labelGoalIds) for (const t of tagsOf(id)) topicLabels.set(t.id, t);
  return { sharedGoals: owned.rows.map((g) => ({ goalId: g.id, title: g.title, tags: tagsOf(g.id) })), topicLabels: [...topicLabels.values()] };
}
