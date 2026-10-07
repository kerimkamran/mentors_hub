/** "What matching can see" (FR-PRF-010, AC-PRF-02.4): exactly the fields the engine reads for me and who sees each. */
import { withOrg } from "@/lib/db";
import { authorize, type Actor } from "@/lib/permissions";
import { describeMatchingView, effectiveLevels, isLevel, type MatchingView } from "./visibility";

export async function getMatchingView(actor: Actor): Promise<MatchingView> {
  authorize(actor, "profile.read.own", { ownerMembershipId: actor.membershipId });
  return withOrg(actor.organisationId, async (tx) => {
    const vis = await tx.query<{ field: string; level: string }>("SELECT field, level FROM profile_field_visibility WHERE membership_id = $1", [actor.membershipId]);
    const stored: Record<string, string> = {};
    for (const v of vis.rows) stored[v.field] = v.level;
    const g = await tx.query<{ visibility: string }>("SELECT visibility FROM goal WHERE membership_id = $1 AND state = 'active'", [actor.membershipId]);
    const mentor = await tx.query("SELECT 1 FROM participation WHERE membership_id = $1 AND kind = 'mentor' AND status <> 'withdrawn' LIMIT 1", [actor.membershipId]);
    return describeMatchingView(effectiveLevels(stored), g.rows.map((x) => x.visibility).filter(isLevel), { isMentor: (mentor.rowCount ?? 0) > 0 });
  });
}
