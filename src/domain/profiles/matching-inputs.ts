/**
 * The ONE query the matching slice (S6/S11) uses to read profile data. It returns only what each owner allowed
 * (a field set to "Only me" is neither returned nor used, AC-PRF-02.2, AC-GOL-01.3) and nothing outside the snapshot table of
 * matching-spec §1.1: no private notes, no goal titles, and never grade bucket or reporting line (those come from the HR record,
 * read by the matching slice itself, and are not part of any profile payload).
 *
 * Fields the owner kept private appear as `undefined` AND in `missing`, the same as fields they never filled in, so the engine
 * cannot tell the two apart (it treats both as missing data: neutral for a mentee, zero for a mentor, C-057/C-058).
 */
import type { Tx } from "@/lib/db";
import type { Depth, Proficiency } from "./constants";
import { loadAvailability, type StoredRule } from "../availability/queries";
import { engineCanRead, effectiveLevels } from "./visibility";
import { MISSING_MENTOR_SCORE } from "./settings";

export interface MatchTopic { topicId: string; parentId: string | null; key: string | null }
export interface MatchGoal { goalId: string; programmeId: string; primary: boolean; tags: MatchTopic[] }

export type MatchCriterion = "topics_offered" | "topics_sought" | "languages" | "interests" | "availability" | "goals";

export interface MatchingInput {
  membershipId: string;
  topicsOffered?: (MatchTopic & { depth: Depth })[];
  topicsSought?: MatchTopic[];
  languages?: { language: string; level: Proficiency }[];
  interests?: { interestId: string; key: string | null }[];
  availability?: { rules: StoredRule[]; windows: StoredRule[] };
  goals?: MatchGoal[];
  /** C-032 minimum profile for a mentor, computed on the person's real data (a flag only; no content). */
  minimumProfile: { hasTopics: boolean; hasExpertiseArea: boolean; met: boolean };
  /** Criteria with no usable data (hidden or empty). */
  missing: MatchCriterion[];
}

export async function getMatchingInputs(tx: Tx, membershipIds: string[], opts: { programmeId?: string } = {}): Promise<Map<string, MatchingInput>> {
  const ids = [...new Set(membershipIds)];
  const out = new Map<string, MatchingInput>();
  if (ids.length === 0) return out;

  const vis = await tx.query<{ membership_id: string; field: string; level: string }>("SELECT membership_id, field, level FROM profile_field_visibility WHERE membership_id = ANY($1::uuid[])", [ids]);
  const levels = new Map<string, ReturnType<typeof effectiveLevels>>();
  for (const id of ids) {
    const stored: Record<string, string> = {};
    for (const v of vis.rows) if (v.membership_id === id) stored[v.field] = v.level;
    levels.set(id, effectiveLevels(stored));
  }
  // The owner must exist and be active in this organisation (RLS scopes the query; others are simply absent).
  const live = await tx.query<{ id: string }>("SELECT id FROM membership WHERE id = ANY($1::uuid[]) AND status = 'active'", [ids]);
  const activeIds = live.rows.map((r) => r.id);

  const tops = await tx.query<{ membership_id: string; topic_id: string; role: string; depth: Depth | null; parent_id: string | null; catalogue_key: string | null }>(
    `SELECT pt.membership_id, pt.topic_id, pt.role, pt.depth, t.parent_id, t.catalogue_key FROM person_topic pt JOIN taxonomy_topic t ON t.id = pt.topic_id AND t.organisation_id = pt.organisation_id
      WHERE pt.membership_id = ANY($1::uuid[]) AND t.is_active`,
    [activeIds],
  );
  const langs = await tx.query<{ membership_id: string; language: string; level: Proficiency }>("SELECT membership_id, language, level FROM person_language WHERE membership_id = ANY($1::uuid[])", [activeIds]);
  const ints = await tx.query<{ membership_id: string; interest_id: string; catalogue_key: string | null }>(
    "SELECT pi.membership_id, pi.interest_id, i.catalogue_key FROM person_interest pi JOIN interest_tag i ON i.id = pi.interest_id AND i.organisation_id = pi.organisation_id WHERE pi.membership_id = ANY($1::uuid[]) AND i.is_active",
    [activeIds],
  );
  const areas = await tx.query<{ membership_id: string }>("SELECT membership_id FROM mentor_expertise_area WHERE membership_id = ANY($1::uuid[])", [activeIds]);
  const avail = await loadAvailability(tx, activeIds);

  // Goals: active, visibility allows, Open programmes only (US-GOL-01). Titles are never selected.
  const goals = await tx.query<{ id: string; membership_id: string; programme_id: string; is_primary: boolean }>(
    `SELECT g.id, g.membership_id, g.programme_id, g.is_primary FROM goal g JOIN programme pr ON pr.id = g.programme_id AND pr.organisation_id = g.organisation_id
      WHERE g.membership_id = ANY($1::uuid[]) AND g.state = 'active' AND g.visibility <> 'only_me' AND pr.type = 'open' AND ($2::uuid IS NULL OR g.programme_id = $2)`,
    [activeIds, opts.programmeId ?? null],
  );
  const tags = goals.rows.length
    ? await tx.query<{ goal_id: string; topic_id: string; parent_id: string | null; catalogue_key: string | null }>(
        `SELECT gt.goal_id, gt.topic_id, t.parent_id, t.catalogue_key FROM goal_tag gt JOIN taxonomy_topic t ON t.id = gt.topic_id AND t.organisation_id = gt.organisation_id WHERE gt.goal_id = ANY($1::uuid[]) AND t.is_active`,
        [goals.rows.map((g) => g.id)],
      )
    : { rows: [] as { goal_id: string; topic_id: string; parent_id: string | null; catalogue_key: string | null }[] };

  for (const id of activeIds) {
    const lv = levels.get(id)!;
    const myTops = tops.rows.filter((t) => t.membership_id === id);
    const ref = (t: (typeof myTops)[number]): MatchTopic => ({ topicId: t.topic_id, parentId: t.parent_id, key: t.catalogue_key });
    const hasTopics = myTops.some((t) => t.role === "offers");
    const hasExpertiseArea = areas.rows.some((a) => a.membership_id === id);
    const input: MatchingInput = { membershipId: id, minimumProfile: { hasTopics, hasExpertiseArea, met: hasTopics && hasExpertiseArea }, missing: [] };
    if (engineCanRead(lv.topics_offered)) input.topicsOffered = myTops.filter((t) => t.role === "offers").map((t) => ({ ...ref(t), depth: t.depth! }));
    if (engineCanRead(lv.topics_sought)) input.topicsSought = myTops.filter((t) => t.role === "seeks").map(ref);
    if (engineCanRead(lv.languages)) input.languages = langs.rows.filter((l) => l.membership_id === id).map((l) => ({ language: l.language, level: l.level }));
    if (engineCanRead(lv.interests)) input.interests = ints.rows.filter((i) => i.membership_id === id).map((i) => ({ interestId: i.interest_id, key: i.catalogue_key }));
    if (engineCanRead(lv.availability)) {
      const a = avail.get(id)!;
      input.availability = { rules: a.rules, windows: a.windows };
    }
    const myGoals = goals.rows.filter((g) => g.membership_id === id);
    input.goals = myGoals.map((g) => ({
      goalId: g.id, programmeId: g.programme_id, primary: g.is_primary,
      tags: tags.rows.filter((t) => t.goal_id === g.id).map((t) => ({ topicId: t.topic_id, parentId: t.parent_id, key: t.catalogue_key })),
    }));
    // missing = hidden or empty
    if (!input.topicsOffered?.length) input.missing.push("topics_offered");
    if (!input.topicsSought?.length) input.missing.push("topics_sought");
    if (!input.languages?.length) input.missing.push("languages");
    if (!input.interests?.length) input.missing.push("interests");
    if (!input.availability || (input.availability.rules.length === 0 && input.availability.windows.length === 0)) input.missing.push("availability");
    if (!input.goals.length) input.missing.push("goals");
    out.set(id, input);
  }
  return out;
}

/** AC-PRF-01.5: score of a criterion whose data is missing: neutral for a mentee/team (C-057), zero for a mentor (C-058; the mentor rule wins when both are missing). */
export function missingDataScore(side: "mentee" | "mentor", neutral: number): number {
  return side === "mentor" ? MISSING_MENTOR_SCORE : neutral;
}
