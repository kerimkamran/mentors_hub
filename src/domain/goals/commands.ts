/**
 * Goals before a relationship (US-GOL-01, Open programmes): a title, taxonomy tags, a state, one optional primary goal, and a
 * visibility. Slice S8 extends goals inside relationships (SMART fields, milestones) on the same table.
 * Owner-only writes; a goal I do not own is "not found".
 */
import { audit } from "@/lib/audit";
import { withOrg, type Tx } from "@/lib/db";
import { authorize, NotFoundError, type Actor } from "@/lib/permissions";
import { MAX_GOAL_TAGS, MAX_GOAL_TITLE } from "../profiles/constants";
import { isUuid, ValidationError } from "../profiles/errors";
import { isLevel } from "../profiles/visibility";

export interface GoalInput { programmeId: string; title: string; tagIds: string[]; visibility?: string }

async function checkTags(tx: Tx, tagIds: string[]): Promise<string[]> {
  const ids = [...new Set(tagIds)];
  if (ids.length < 1 || ids.length > MAX_GOAL_TAGS || !ids.every(isUuid)) throw new ValidationError("goal.tags");
  const ok = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM taxonomy_topic WHERE id = ANY($1::uuid[]) AND is_active", [ids]);
  if (ok.rows[0]!.n !== ids.length) throw new ValidationError("goal.tags"); // taxonomy only, no free text
  return ids;
}

const cleanTitle = (t: string) => {
  const s = t.trim().replace(/\s+/g, " ");
  if (s.length < 1 || s.length > MAX_GOAL_TITLE) throw new ValidationError("goal.title");
  return s;
};

/** Creates a draft goal in an Open programme where I am a mentee. */
export async function createGoal(actor: Actor, input: GoalInput): Promise<string> {
  authorize(actor, "goal.edit.own", { ownerMembershipId: actor.membershipId });
  if (!isUuid(input.programmeId)) throw new NotFoundError();
  const title = cleanTitle(input.title);
  const visibility = input.visibility ?? "only_me";
  if (!isLevel(visibility)) throw new ValidationError("goal.visibility");
  return withOrg(actor.organisationId, async (tx) => {
    // The programme must be an Open programme in which I take part as a mentee; anything else looks like a missing programme.
    const ok = await tx.query(
      `SELECT 1 FROM programme pr JOIN cohort c ON c.programme_id = pr.id AND c.organisation_id = pr.organisation_id
         JOIN participation p ON p.cohort_id = c.id AND p.organisation_id = c.organisation_id
        WHERE pr.id = $1 AND pr.type = 'open' AND p.membership_id = $2 AND p.kind = 'mentee' AND p.status <> 'withdrawn' LIMIT 1`,
      [input.programmeId, actor.membershipId],
    );
    if (!ok.rowCount) throw new NotFoundError();
    const tags = await checkTags(tx, input.tagIds);
    const g = await tx.query<{ id: string }>(
      "INSERT INTO goal (organisation_id, membership_id, programme_id, title, visibility) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [actor.organisationId, actor.membershipId, input.programmeId, title, visibility],
    );
    for (const t of tags) await tx.query("INSERT INTO goal_tag (organisation_id, goal_id, topic_id) VALUES ($1, $2, $3)", [actor.organisationId, g.rows[0]!.id, t]);
    return g.rows[0]!.id;
  });
}

interface GoalRow { id: string; membership_id: string; state: string; visibility: string; is_primary: boolean; programme_id: string }

async function loadOwned(tx: Tx, actor: Actor, goalId: string): Promise<GoalRow> {
  if (!isUuid(goalId)) throw new NotFoundError();
  const r = await tx.query<GoalRow>("SELECT id, membership_id, state, visibility, is_primary, programme_id FROM goal WHERE id = $1 FOR UPDATE", [goalId]);
  const row = r.rows[0];
  if (!row) throw new NotFoundError();
  authorize(actor, "goal.edit.own", { ownerMembershipId: row.membership_id }); // someone else's goal: the same "not found"
  return row;
}

/** Edit title, tags or visibility of a draft or active goal. Visibility changes are audited by id. */
export async function updateGoal(actor: Actor, goalId: string, patch: { title?: string; tagIds?: string[]; visibility?: string }): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    const g = await loadOwned(tx, actor, goalId);
    if (g.state !== "draft" && g.state !== "active") throw new ValidationError("goal.state");
    if (patch.title !== undefined) await tx.query("UPDATE goal SET title = $2, updated_at = now() WHERE id = $1", [goalId, cleanTitle(patch.title)]);
    if (patch.tagIds !== undefined) {
      const tags = await checkTags(tx, patch.tagIds);
      await tx.query("DELETE FROM goal_tag WHERE goal_id = $1", [goalId]);
      for (const t of tags) await tx.query("INSERT INTO goal_tag (organisation_id, goal_id, topic_id) VALUES ($1, $2, $3)", [actor.organisationId, goalId, t]);
      await tx.query("UPDATE goal SET updated_at = now() WHERE id = $1", [goalId]);
    }
    if (patch.visibility !== undefined) {
      if (!isLevel(patch.visibility)) throw new ValidationError("goal.visibility");
      await tx.query("UPDATE goal SET visibility = $2, updated_at = now() WHERE id = $1", [goalId, patch.visibility]);
      await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "goal.visibility_changed", objectType: "goal", objectId: goalId });
    }
  });
}

/** draft -> active (AC-GOL-01.2). It then counts for recommendations if its visibility allows. */
export async function activateGoal(actor: Actor, goalId: string): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    const g = await loadOwned(tx, actor, goalId);
    if (g.state !== "draft") throw new ValidationError("goal.state");
    const tags = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM goal_tag WHERE goal_id = $1", [goalId]);
    if (tags.rows[0]!.n < 1) throw new ValidationError("goal.tags");
    await tx.query("UPDATE goal SET state = 'active', updated_at = now() WHERE id = $1", [goalId]);
  });
}

/** draft or active -> dropped. A dropped goal is no longer primary and no longer feeds matching. */
export async function dropGoal(actor: Actor, goalId: string): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    const g = await loadOwned(tx, actor, goalId);
    if (g.state !== "draft" && g.state !== "active") throw new ValidationError("goal.state");
    await tx.query("UPDATE goal SET state = 'dropped', is_primary = false, updated_at = now() WHERE id = $1", [goalId]);
  });
}

/** Marks one goal as my primary goal in its programme (AC-GOL-01.1); the previous primary is cleared in the same transaction. */
export async function setPrimaryGoal(actor: Actor, goalId: string, primary = true): Promise<void> {
  await withOrg(actor.organisationId, async (tx) => {
    const g = await loadOwned(tx, actor, goalId);
    if (g.state !== "draft" && g.state !== "active") throw new ValidationError("goal.state");
    if (primary) await tx.query("UPDATE goal SET is_primary = false WHERE membership_id = $1 AND programme_id = $2 AND is_primary", [actor.membershipId, g.programme_id]);
    await tx.query("UPDATE goal SET is_primary = $2, updated_at = now() WHERE id = $1", [goalId, primary]);
  });
}
