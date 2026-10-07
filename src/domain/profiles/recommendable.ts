/**
 * "Know whether I am recommendable" (US-PRF-04, FR-PRF-006, C-032).
 * A mentor is recommended or discoverable only if approved (S5, via getMentorStatus) AND the minimum profile is met:
 * at least one topic offered and at least one expertise area.
 */
import { withOrg, type Tx } from "@/lib/db";
import { authorize, type Actor } from "@/lib/permissions";
import { defaultProfileDeps, type ProfileDeps } from "./deps";
import { effectiveLevels, engineCanRead } from "./visibility";

export type MissingPart = "approval" | "topics" | "expertise_area";

export interface Recommendability {
  approved: boolean;
  hasTopics: boolean;
  hasExpertiseArea: boolean;
  /** The profile is complete but its topics are set to "Only me", so matching cannot use them (a hint, not a blocker). */
  topicsHiddenFromMatching: boolean;
  /** What is still needed, in the order the person should do it. Approval is listed only for information. */
  missing: MissingPart[];
  recommendable: boolean;
}

export async function recommendability(tx: Tx, membershipId: string, deps: ProfileDeps = defaultProfileDeps): Promise<Recommendability> {
  const counts = await tx.query<{ topics: number; areas: number }>(
    `SELECT (SELECT count(*)::int FROM person_topic WHERE membership_id = $1 AND role = 'offers') AS topics,
            (SELECT count(*)::int FROM mentor_expertise_area WHERE membership_id = $1) AS areas`,
    [membershipId],
  );
  const vis = await tx.query<{ field: string; level: string }>("SELECT field, level FROM profile_field_visibility WHERE membership_id = $1", [membershipId]);
  const stored: Record<string, string> = {};
  for (const v of vis.rows) stored[v.field] = v.level;
  const levels = effectiveLevels(stored);
  const approved = (await deps.getMentorStatus(tx, membershipId)).approved;
  const hasTopics = counts.rows[0]!.topics > 0;
  const hasExpertiseArea = counts.rows[0]!.areas > 0;
  const missing: MissingPart[] = [];
  if (!approved) missing.push("approval");
  if (!hasTopics) missing.push("topics");
  if (!hasExpertiseArea) missing.push("expertise_area");
  return {
    approved, hasTopics, hasExpertiseArea,
    topicsHiddenFromMatching: hasTopics && !engineCanRead(levels.topics_offered),
    missing, recommendable: approved && hasTopics && hasExpertiseArea,
  };
}

/** For discovery and recommendation lists (AC-PRF-04.2/04.3): keeps only the people who may appear. */
export async function filterRecommendable(tx: Tx, membershipIds: string[], deps: ProfileDeps = defaultProfileDeps): Promise<string[]> {
  const out: string[] = [];
  for (const id of [...new Set(membershipIds)]) if ((await recommendability(tx, id, deps)).recommendable) out.push(id);
  return out;
}

export interface FinishProfileCard {
  /** What is missing from the minimum profile (never includes approval: this card is for approved mentors). */
  missing: Exclude<MissingPart, "approval">[];
}

/** Home's main card for an approved mentor whose profile is below the minimum (AC-PRF-04.1). Null when there is nothing to finish. */
export async function finishProfileCard(actor: Actor, deps: ProfileDeps = defaultProfileDeps): Promise<FinishProfileCard | null> {
  authorize(actor, "profile.read.own", { ownerMembershipId: actor.membershipId });
  return withOrg(actor.organisationId, async (tx) => {
    const r = await recommendability(tx, actor.membershipId, deps);
    if (!r.approved) return null;
    const missing = r.missing.filter((m): m is Exclude<MissingPart, "approval"> => m !== "approval");
    return missing.length > 0 ? { missing } : null;
  });
}

/** The checklist on the profile page (SCR-03). Null for people who are not approved mentors. */
export async function mentorChecklist(actor: Actor, deps: ProfileDeps = defaultProfileDeps): Promise<Recommendability | null> {
  authorize(actor, "profile.read.own", { ownerMembershipId: actor.membershipId });
  return withOrg(actor.organisationId, async (tx) => {
    const r = await recommendability(tx, actor.membershipId, deps);
    return r.approved ? r : null;
  });
}
