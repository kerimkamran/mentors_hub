import { audit } from "@/lib/audit";
import { withOrg, type Tx } from "@/lib/db";
import { authorize, NotFoundError, type Actor } from "@/lib/permissions";
import { isUuid } from "../profiles/errors";

/** I block someone: neither of us is shown to, or matched with, the other (hard exclusion BLOCKED, never overridable, C-081). */
export async function blockPerson(actor: Actor, targetMembershipId: string): Promise<void> {
  authorize(actor, "block.manage.own", { ownerMembershipId: actor.membershipId });
  if (!isUuid(targetMembershipId) || targetMembershipId === actor.membershipId) throw new NotFoundError();
  await withOrg(actor.organisationId, async (tx) => {
    const t = await tx.query("SELECT 1 FROM membership WHERE id = $1 AND status = 'active'", [targetMembershipId]);
    if (!t.rowCount) throw new NotFoundError(); // another organisation's person is invisible under RLS: same answer
    await tx.query(
      "INSERT INTO block (organisation_id, blocker_membership_id, blocked_membership_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [actor.organisationId, actor.membershipId, targetMembershipId],
    );
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "block.add", objectType: "membership", objectId: targetMembershipId });
  });
}

export async function unblockPerson(actor: Actor, targetMembershipId: string): Promise<void> {
  authorize(actor, "block.manage.own", { ownerMembershipId: actor.membershipId });
  if (!isUuid(targetMembershipId)) throw new NotFoundError();
  await withOrg(actor.organisationId, async (tx) => {
    await tx.query("DELETE FROM block WHERE blocker_membership_id = $1 AND blocked_membership_id = $2", [actor.membershipId, targetMembershipId]);
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "block.remove", objectType: "membership", objectId: targetMembershipId });
  });
}

/** People I have blocked. The blocked person can never learn of it, so there is no reverse query for participants. */
export async function listMyBlocks(actor: Actor): Promise<string[]> {
  authorize(actor, "block.manage.own", { ownerMembershipId: actor.membershipId });
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ blocked_membership_id: string }>("SELECT blocked_membership_id FROM block WHERE blocker_membership_id = $1", [actor.membershipId]);
    return r.rows.map((x) => x.blocked_membership_id);
  });
}

/** For the matching engine (system use, no actor): the blocked pairs among the given people, either direction. */
export async function getBlockedPairs(tx: Tx, membershipIds: string[]): Promise<{ blocker: string; blocked: string }[]> {
  if (membershipIds.length === 0) return [];
  const r = await tx.query<{ blocker_membership_id: string; blocked_membership_id: string }>(
    "SELECT blocker_membership_id, blocked_membership_id FROM block WHERE blocker_membership_id = ANY($1::uuid[]) OR blocked_membership_id = ANY($1::uuid[])",
    [membershipIds],
  );
  return r.rows.map((x) => ({ blocker: x.blocker_membership_id, blocked: x.blocked_membership_id }));
}
