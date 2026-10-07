/**
 * Profile reads. The owner reads everything of their own; everyone else reads only fields the owner made visible to them
 * (matrix §4.4, §5). Grade bucket and reporting line are not profile fields and appear in NO payload here (AC-PRF-02.5).
 */
import type { Locale } from "@/lib/constants";
import { withOrg, type Tx } from "@/lib/db";
import { authorize, can, NotFoundError, type Actor } from "@/lib/permissions";
import { loadAvailability, type StoredRule } from "../availability/queries";
import { getTopicRefs, toTopicRef, type TopicRef, type TopicRow } from "../taxonomy/queries";
import type { Depth, Proficiency, VisibilityField } from "./constants";
import { defaultProfileDeps, type ProfileDeps } from "./deps";
import { isUuid } from "./errors";
import { queryKey, likeEscape } from "./search";
import { isBlockedEitherWay, loadOwnerFacts, loadViewerFacts, visibleFields } from "./viewer";
import { effectiveLevels, type LevelMap } from "./visibility";

export interface OfferedTopic { topic: TopicRef; depth: Depth }
export interface LanguageEntry { language: string; level: Proficiency }
export interface InterestEntry { id: string; key: string | null; name: string }

export interface OwnProfile {
  membershipId: string;
  /** HR basics, read-only in the UI (SCR-03). */
  displayName: string;
  department: string | null;
  jobTitle: string | null;
  headline: string | null;
  bio: string | null;
  levels: LevelMap;
  languages: LanguageEntry[];
  interests: InterestEntry[];
  offers: OfferedTopic[];
  seeks: TopicRef[];
  expertiseAreas: TopicRef[];
  draft: { bio?: string; headline?: string } | null;
  draftUpdatedAt: Date | null;
}

const TOPIC_COLS = `t.id, t.parent_id, t.catalogue_key, t.name_en, t.name_az, t.name_ru, p.name_en AS p_name_en, p.name_az AS p_name_az, p.name_ru AS p_name_ru`;
const TOPIC_FROM = `taxonomy_topic t LEFT JOIN taxonomy_topic p ON p.id = t.parent_id AND p.organisation_id = t.organisation_id`;

type Raw = {
  languages: LanguageEntry[]; interests: InterestEntry[]; offers: { topicId: string; depth: Depth }[]; seeks: string[]; areas: string[];
};

async function loadRaw(tx: Tx, id: string, locale: Locale): Promise<Raw & { topics: Map<string, TopicRef> }> {
  const langs = await tx.query<{ language: string; level: Proficiency }>("SELECT language, level FROM person_language WHERE membership_id = $1 ORDER BY language", [id]);
  const ints = await tx.query<{ id: string; catalogue_key: string | null; name_en: string; name_az: string; name_ru: string }>(
    `SELECT i.id, i.catalogue_key, i.name_en, i.name_az, i.name_ru FROM person_interest pi JOIN interest_tag i ON i.id = pi.interest_id AND i.organisation_id = pi.organisation_id WHERE pi.membership_id = $1 ORDER BY i.sort_order`,
    [id],
  );
  const tops = await tx.query<{ topic_id: string; role: "offers" | "seeks"; depth: Depth | null }>("SELECT topic_id, role, depth FROM person_topic WHERE membership_id = $1", [id]);
  const areas = await tx.query<{ topic_id: string }>("SELECT topic_id FROM mentor_expertise_area WHERE membership_id = $1", [id]);
  const ids = [...new Set([...tops.rows.map((t) => t.topic_id), ...areas.rows.map((a) => a.topic_id)])];
  const refs = await getTopicRefs(tx, ids, locale);
  const topics = new Map(refs.map((r) => [r.id, r]));
  const nm = (r: { name_en: string; name_az: string; name_ru: string }) => (locale === "az" ? r.name_az : locale === "ru" ? r.name_ru : r.name_en);
  return {
    languages: langs.rows,
    interests: ints.rows.map((i) => ({ id: i.id, key: i.catalogue_key, name: nm(i) })),
    offers: tops.rows.filter((t) => t.role === "offers").map((t) => ({ topicId: t.topic_id, depth: t.depth! })),
    seeks: tops.rows.filter((t) => t.role === "seeks").map((t) => t.topic_id),
    areas: areas.rows.map((a) => a.topic_id),
    topics,
  };
}

const byName = (a: TopicRef, b: TopicRef) => a.name.localeCompare(b.name);

/** The signed-in person's complete profile with the effective visibility of every field. */
export async function getOwnProfile(actor: Actor): Promise<OwnProfile> {
  authorize(actor, "profile.read.own", { ownerMembershipId: actor.membershipId });
  return withOrg(actor.organisationId, async (tx) => {
    const p = await tx.query<{ display_name: string; department: string | null; job_title: string | null; headline: string | null; bio: string | null }>(
      "SELECT display_name, department, job_title, headline, bio FROM person_profile WHERE membership_id = $1",
      [actor.membershipId],
    );
    const row = p.rows[0];
    if (!row) throw new NotFoundError();
    const vis = await tx.query<{ field: string; level: string }>("SELECT field, level FROM profile_field_visibility WHERE membership_id = $1", [actor.membershipId]);
    const stored: Record<string, string> = {};
    for (const v of vis.rows) stored[v.field] = v.level;
    const raw = await loadRaw(tx, actor.membershipId, actor.locale);
    const d = await tx.query<{ payload: { bio?: string; headline?: string }; updated_at: Date }>("SELECT payload, updated_at FROM profile_draft WHERE membership_id = $1", [actor.membershipId]);
    return {
      membershipId: actor.membershipId, displayName: row.display_name, department: row.department, jobTitle: row.job_title, headline: row.headline, bio: row.bio,
      levels: effectiveLevels(stored), languages: raw.languages, interests: raw.interests,
      offers: raw.offers.map((o) => ({ topic: raw.topics.get(o.topicId)!, depth: o.depth })).filter((o) => o.topic).sort((a, b) => byName(a.topic, b.topic)),
      seeks: raw.seeks.map((id) => raw.topics.get(id)!).filter(Boolean).sort(byName),
      expertiseAreas: raw.areas.map((id) => raw.topics.get(id)!).filter(Boolean).sort(byName),
      draft: d.rows[0]?.payload ?? null, draftUpdatedAt: d.rows[0]?.updated_at ?? null,
    };
  });
}

/** What another person is allowed to read. A key that is absent was not returned (hidden or empty is never distinguished). */
export interface ProfileView {
  membershipId: string;
  name?: string;
  department?: string;
  jobTitle?: string;
  headline?: string;
  bio?: string;
  languages?: LanguageEntry[];
  interests?: InterestEntry[];
  topicsOffered?: OfferedTopic[];
  topicsSought?: TopicRef[];
  availability?: { rules: StoredRule[]; windows: StoredRule[] };
  /** True when the reader sees only the PM basics (name, department). */
  basicOnly: boolean;
}

/**
 * Another person's profile as `actor` may read it (AC-PRF-02.2, AC-PRF-02.3).
 * Denied, hidden, blocked, other-organisation and unknown all end in the same NotFoundError when nothing at all is readable.
 */
export async function readProfileForViewer(actor: Actor, targetMembershipId: string, deps: ProfileDeps = defaultProfileDeps): Promise<ProfileView> {
  authorize(actor, "profile.read.other");
  if (!isUuid(targetMembershipId)) throw new NotFoundError();
  return withOrg(actor.organisationId, async (tx) => {
    const exists = await tx.query<{ display_name: string; department: string | null; job_title: string | null; headline: string | null; bio: string | null }>(
      `SELECT p.display_name, p.department, p.job_title, p.headline, p.bio FROM person_profile p JOIN membership m ON m.id = p.membership_id AND m.organisation_id = p.organisation_id
        WHERE p.membership_id = $1 AND m.status = 'active'`,
      [targetMembershipId],
    );
    const row = exists.rows[0];
    if (!row) throw new NotFoundError();
    if (targetMembershipId === actor.membershipId) throw new NotFoundError(); // own profile has its own query; keeps this one strictly "other people"
    if (await isBlockedEitherWay(tx, actor.membershipId, targetMembershipId)) throw new NotFoundError();

    const viewer = await loadViewerFacts(tx, actor.membershipId, deps);
    const owner = (await loadOwnerFacts(tx, [targetMembershipId])).get(targetMembershipId)!;
    const fields = visibleFields(viewer, owner);

    // PM within scope of one of the person's programmes: basics only (matrix §4.4).
    const progs = await tx.query<{ programme_id: string; cohort_id: string }>(
      "SELECT c.programme_id, c.id AS cohort_id FROM participation p JOIN cohort c ON c.id = p.cohort_id AND c.organisation_id = p.organisation_id WHERE p.membership_id = $1 AND p.status <> 'withdrawn'",
      [targetMembershipId],
    );
    const pmBasic = progs.rows.some((p) => can(actor, "profile.read.basic", { programmeId: p.programme_id, cohortId: p.cohort_id }));
    const basicFields: VisibilityField[] = pmBasic ? ["name", "department"] : [];
    const allowed = new Set<VisibilityField>([...fields, ...basicFields]);
    if (allowed.size === 0) throw new NotFoundError();

    const view: ProfileView = { membershipId: targetMembershipId, basicOnly: allowed.size > 0 && [...allowed].every((f) => f === "name" || f === "department") && fields.size === 0 };
    if (allowed.has("name")) view.name = row.display_name;
    if (allowed.has("department") && row.department) view.department = row.department;
    if (fields.has("job_title") && row.job_title) view.jobTitle = row.job_title;
    if (fields.has("headline") && row.headline) view.headline = row.headline;
    if (fields.has("bio") && row.bio) view.bio = row.bio;
    if (fields.has("languages") || fields.has("interests") || fields.has("topics_offered") || fields.has("topics_sought")) {
      const raw = await loadRaw(tx, targetMembershipId, actor.locale);
      if (fields.has("languages")) view.languages = raw.languages;
      if (fields.has("interests")) view.interests = raw.interests;
      if (fields.has("topics_offered")) view.topicsOffered = raw.offers.map((o) => ({ topic: raw.topics.get(o.topicId)!, depth: o.depth })).filter((o) => o.topic);
      if (fields.has("topics_sought")) view.topicsSought = raw.seeks.map((id) => raw.topics.get(id)!).filter(Boolean);
    }
    if (fields.has("availability")) {
      const a = (await loadAvailability(tx, [targetMembershipId])).get(targetMembershipId)!;
      view.availability = { rules: a.rules, windows: a.windows };
    }
    return view;
  });
}

export interface PersonHit { membershipId: string; name: string; department: string | null }

/**
 * People search for discovery pickers (AC-PRF-01.3): accent-folding ("mammadov" finds Məmmədov, "ozbek" finds Özbək), and only
 * people whose NAME the searcher may read. No hint of hidden matches (matrix §6).
 */
export async function searchPeople(actor: Actor, query: string, deps: ProfileDeps = defaultProfileDeps, limit = 20): Promise<PersonHit[]> {
  authorize(actor, "profile.read.other");
  const words = queryKey(query).split(" ").filter(Boolean).slice(0, 5);
  if (words.length === 0) return [];
  const params: unknown[] = [actor.membershipId];
  const clauses = words.map((w) => {
    params.push(`%${likeEscape(w)}%`);
    return `mh_search_key(p.display_name) LIKE $${params.length} ESCAPE '\\'`;
  });
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ membership_id: string; display_name: string; department: string | null }>(
      `SELECT p.membership_id, p.display_name, p.department FROM person_profile p JOIN membership m ON m.id = p.membership_id AND m.organisation_id = p.organisation_id
        WHERE m.status = 'active' AND p.membership_id <> $1 AND ${clauses.join(" AND ")} ORDER BY p.display_name LIMIT 200`,
      params,
    );
    if (r.rows.length === 0) return [];
    const viewer = await loadViewerFacts(tx, actor.membershipId, deps);
    const owners = await loadOwnerFacts(tx, r.rows.map((x) => x.membership_id));
    const blocked = await tx.query<{ a: string; b: string }>(
      "SELECT blocker_membership_id AS a, blocked_membership_id AS b FROM block WHERE blocker_membership_id = $1 OR blocked_membership_id = $1",
      [actor.membershipId],
    );
    const blockedSet = new Set(blocked.rows.flatMap((x) => [x.a, x.b]));
    return r.rows
      .filter((x) => !blockedSet.has(x.membership_id) && visibleFields(viewer, owners.get(x.membership_id)!).has("name"))
      .slice(0, limit)
      .map((x) => ({ membershipId: x.membership_id, name: x.display_name, department: visibleFields(viewer, owners.get(x.membership_id)!).has("department") ? x.department : null }));
  });
}

export type { TopicRow };
export { toTopicRef };

export type ParticipationKind = "mentor" | "mentee" | "team_member";

/** Which sides of mentoring I take part in (labels such as "Mentors in my programme" depend on it). */
export async function getMyParticipationKinds(actor: Actor): Promise<Set<ParticipationKind>> {
  authorize(actor, "profile.read.own", { ownerMembershipId: actor.membershipId });
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ kind: ParticipationKind }>("SELECT DISTINCT kind FROM participation WHERE membership_id = $1 AND status <> 'withdrawn'", [actor.membershipId]);
    return new Set(r.rows.map((x) => x.kind));
  });
}
