import { dayNumber } from "./availability";
import type { MentorCtx, SeekerCtx } from "./scoring";
import { EXCLUSION_CODES, type ExclusionCode, type MatchingSettings, type MatchingSnapshot, type PairHistoryEntry } from "./types";

/** Lookup tables built once per run from the canonical snapshot. */
export interface ExclusionEnv {
  settings: MatchingSettings;
  asOfDay: number;
  blocked: Set<string>; // `${blocker}>${blocked}`
  history: Map<string, PairHistoryEntry[]>; // `${seekerOrMemberId}>${mentorId}`
}

export function buildExclusionEnv(snap: MatchingSnapshot, settings: MatchingSettings): ExclusionEnv {
  const blocked = new Set(snap.blocks.map((b) => `${b.blockerId}>${b.blockedId}`));
  const history = new Map<string, PairHistoryEntry[]>();
  for (const h of snap.history) {
    const k = `${h.seekerId}>${h.mentorId}`;
    const l = history.get(k) ?? [];
    l.push(h);
    history.set(k, l);
  }
  return { settings, asOfDay: dayNumber(snap.programme.asOf), blocked, history };
}

/**
 * Hard exclusions for one seeker–mentor pair (matching-spec §3). For a team every member is checked against the mentor.
 * Returns the codes that apply (switched-off exclusions are not evaluated), in the fixed code order. Pure.
 *
 * `overlapDays` is the pair's overlap computed on the horizon (null when either side has not provided availability —
 * an exclusion is never raised from missing data; the score handles that case, §4 missing-data rule).
 */
export function evaluateExclusions(env: ExclusionEnv, sc: SeekerCtx, mc: MentorCtx, overlapDays: number | null, programmeType: MatchingSnapshot["programme"]["type"]): ExclusionCode[] {
  const s = env.settings;
  const { seeker } = sc;
  const m = mc.mentor;
  const hit = new Set<ExclusionCode>();
  const on = (c: ExclusionCode) => s.exclusions[c] === true;

  const refs = [seeker.id, ...seeker.members.map((x) => x.personId)];

  if (on("SAME_PERSON") && seeker.members.some((x) => x.personId === m.personId)) hit.add("SAME_PERSON");
  if (on("BLOCKED") && seeker.members.some((x) => env.blocked.has(`${x.personId}>${m.personId}`) || env.blocked.has(`${m.personId}>${x.personId}`))) hit.add("BLOCKED");
  if (on("NOT_APPROVED") && !m.approved) hit.add("NOT_APPROVED");
  if (on("ELIGIBILITY") && (!m.eligible || seeker.members.some((x) => !x.eligible))) hit.add("ELIGIBILITY");

  // Relationship history. A rematch's previous mentor is excluded unless a PM overrides (matching-spec §7 rule 3), whatever the switch says.
  let incompatible = false;
  let declined = false;
  for (const ref of refs) {
    for (const h of env.history.get(`${ref}>${m.personId}`) ?? []) {
      if (h.kind === "incompatible" && on("INCOMPATIBLE_HISTORY")) incompatible = true;
      if (h.kind === "rematch_previous") incompatible = true;
      // Declined on day D ⇒ excluded on D … D + cooldown − 1 (a cool-off of 90 days blocks 90 days, MT-S8).
      if (h.kind === "declined" && on("DECLINED_RECENTLY") && h.on !== null && env.asOfDay - dayNumber(h.on) < s.declineCooldownDays) declined = true;
    }
  }
  if (incompatible) hit.add("INCOMPATIBLE_HISTORY");
  if (declined) hit.add("DECLINED_RECENTLY");

  if (on("REPORTING_LINE") && seeker.members.some((x) => isLine(x.personId, x.reporting, m.personId, m.reporting))) hit.add("REPORTING_LINE");
  if (on("REPORTING_PEER") && seeker.members.some((x) => x.reporting.managerId !== null && x.reporting.managerId === m.reporting.managerId)) hit.add("REPORTING_PEER");
  if (on("MENTOR_JUNIOR") && m.gradeBucket !== null && seeker.members.some((x) => x.gradeBucket !== null && m.gradeBucket! < x.gradeBucket)) hit.add("MENTOR_JUNIOR");

  if (on("NO_LANGUAGE") && m.languages && m.languages.length > 0) {
    const ml = new Set(m.languages.map((l) => l.language));
    if (seeker.members.some((x) => x.languages && x.languages.length > 0 && !x.languages.some((l) => ml.has(l.language)))) hit.add("NO_LANGUAGE");
  }
  if (on("NO_AVAILABILITY") && overlapDays === 0) hit.add("NO_AVAILABILITY");
  if (on("CAPACITY_FULL") && m.load >= m.capacity) hit.add("CAPACITY_FULL");
  if (on("ALREADY_MATCHED")) {
    const pendingLimit = programmeType === "open" ? s.openRequestLimit : 1;
    if (seeker.acceptedMatches > 0 || seeker.pendingMatches >= pendingLimit) hit.add("ALREADY_MATCHED");
  }
  return EXCLUSION_CODES.filter((c) => hit.has(c));
}

/** Direct manager or skip-level, in either direction (REPORTING_LINE). */
function isLine(aId: string, a: { managerId: string | null; skipLevelId: string | null }, bId: string, b: { managerId: string | null; skipLevelId: string | null }): boolean {
  return a.managerId === bId || a.skipLevelId === bId || b.managerId === aId || b.skipLevelId === aId;
}
