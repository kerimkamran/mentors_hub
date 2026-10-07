import { buildHorizon } from "./availability";
import { buildExclusionEnv, evaluateExclusions } from "./exclusions";
import { explainPool } from "./explain";
import { canonicalise } from "./normalise";
import { buildMentorCtx, buildSeekerCtx, pairOverlapDays, scorePair, TaxIndex, type MentorCtx, type PairScore, type ScoreEnv, type SeekerCtx } from "./scoring";
import { ENGINE_VERSION, assertValidSettings } from "./settings";
import { canonicalJson, sha256Hex } from "./hash";
import {
  InvalidMatchingInputError,
  isLocked,
  type CandidateExclusion,
  type DraftResult,
  type ExcludedPair,
  type ExclusionCode,
  type MatchingMode,
  type MatchingResult,
  type MatchingSettings,
  type MatchingSnapshot,
  type RankedCandidate,
  type SeekerResult,
} from "./types";

interface Ranked {
  mentor: MentorCtx;
  score: PairScore;
  overridden: ExclusionCode[];
}

/**
 * The matching engine (matching-spec §1): pool → hard exclusions → scoring → ranking → explanation.
 *
 * A pure function of (snapshot, settings, mode): no database, clock, randomness or network (INV-7.1). Input order never affects
 * the output (MT-P3) and unknown/private fields are ignored (MT-P5). Settings out of bounds throw `InvalidSettingsError` (MT-P12).
 *
 * mode `recommend` — per-seeker ranked candidates and the Open "Recommended" list (first C-024 recommendable candidates).
 * mode `draft`     — additionally the deterministic greedy admin draft (Leadership / SparkLab only, matching-spec §5).
 */
export function runMatching(snapshot: MatchingSnapshot, settings: MatchingSettings, mode: MatchingMode): MatchingResult {
  assertValidSettings(settings);
  if (mode !== "recommend" && mode !== "draft") throw new InvalidMatchingInputError(`unknown mode ${String(mode)}`);
  const snap = canonicalise(snapshot, settings);
  if (mode === "draft" && snap.programme.type === "open") throw new InvalidMatchingInputError("the admin draft applies to Leadership and SparkLab programmes only");

  const snapshotHash = sha256Hex(canonicalJson({ snapshot: snap, settings }));
  const needAvail = settings.weights.availability > 0 || settings.exclusions.NO_AVAILABILITY;
  const env: ScoreEnv = {
    settings,
    snap,
    tax: new TaxIndex(snap),
    horizon: needAvail ? buildHorizon(snap.programme.asOf, settings.availabilityHorizonWeeks, settings.slotMinutes) : null,
    questions: snap.questionnaire,
  };
  const exEnv = buildExclusionEnv(snap, settings);
  const mentorCtx = snap.mentors.map((m) => buildMentorCtx(env, m));
  const overrideSet = new Set(snap.overrides.map((o) => `${o.seekerId}\u0000${o.mentorId}\u0000${o.code}`));

  const seekers: SeekerResult[] = [];
  const rankedBySeeker = new Map<string, Ranked[]>();
  for (const seeker of snap.seekers) {
    const sc = buildSeekerCtx(env, seeker);
    const ranked: Ranked[] = [];
    const excluded: ExcludedPair[] = [];
    const outOfPool: SeekerResult["outOfPool"] = [];

    for (const mc of mentorCtx) {
      const m = mc.mentor;
      // Pool rule 3: same organisation.
      if (m.organisationId !== seeker.organisationId || m.organisationId !== snap.organisationId) {
        outOfPool.push({ mentorId: m.personId, reason: "ORGANISATION" });
        continue;
      }
      const days = needAvail ? pairOverlapDays(env, sc, mc) : null;
      const codes = evaluateExclusions(exEnv, sc, mc, days, snap.programme.type);
      // Pool rule 2: minimum profile (an unapproved mentor is reported as NOT_APPROVED instead).
      if (m.approved && !m.minimumProfile && !m.browsableWithoutMinimumProfile) {
        outOfPool.push({ mentorId: m.personId, reason: "MINIMUM_PROFILE" });
        continue;
      }
      const marked: CandidateExclusion[] = codes.map((code) => ({ code, locked: isLocked(code), overridden: !isLocked(code) && overrideSet.has(`${seeker.id}\u0000${m.personId}\u0000${code}`) }));
      if (marked.some((x) => x.locked || !x.overridden)) {
        excluded.push({ mentorId: m.personId, exclusions: marked });
        continue;
      }
      ranked.push({ mentor: mc, score: scorePair(env, sc, mc, days), overridden: marked.map((x) => x.code) });
    }

    // Step 4: total desc → lower load → higher goal sub-score → mentor id ascending (locale-independent).
    const goalSub = (r: Ranked) => r.score.breakdown[0]!.subscore;
    ranked.sort(
      (a, b) =>
        b.score.totalUnits - a.score.totalUnits ||
        a.mentor.mentor.load - b.mentor.mentor.load ||
        goalSub(b) - goalSub(a) ||
        (a.mentor.mentor.personId < b.mentor.mentor.personId ? -1 : a.mentor.mentor.personId > b.mentor.mentor.personId ? 1 : 0),
    );
    rankedBySeeker.set(seeker.id, ranked);

    // Step 5: explanations.
    const reasons = explainPool(env, ranked);
    const f = 10 ** settings.scorePrecision;
    const candidates: RankedCandidate[] = ranked.map((r, i) => ({
      mentorId: r.mentor.mentor.personId,
      rank: i + 1,
      total: r.score.totalUnits / f,
      breakdown: r.score.breakdown,
      overriddenCodes: r.overridden,
      recommendable: r.mentor.mentor.minimumProfile,
      explanation: reasons[i]!,
    }));
    seekers.push({
      seekerId: seeker.id,
      kind: seeker.kind,
      poolSize: candidates.length,
      candidates,
      recommended: candidates.filter((c) => c.recommendable).slice(0, settings.recommendedListSize).map((c) => c.mentorId),
      excluded: excluded.sort((a, b) => (a.mentorId < b.mentorId ? -1 : a.mentorId > b.mentorId ? 1 : 0)),
      outOfPool,
    });
  }

  return {
    engineVersion: ENGINE_VERSION,
    settingsVersionId: settings.versionId,
    snapshotHash,
    mode,
    programmeType: snap.programme.type,
    asOf: snap.programme.asOf,
    seekers,
    draft: mode === "draft" ? greedyDraft(seekers, snap) : null,
  };
}

/**
 * Deterministic greedy admin draft (matching-spec §5, OQ-B1-18):
 *  1. seekers in ascending order of number of non-excluded candidates, then by id;
 *  2. each seeker takes their top-ranked recommendable mentor with remaining capacity (capacity − load − already drafted; a team uses one unit, C-022);
 *  3. seekers with no available mentor stay unmatched.
 * Capacity is never exceeded (MT-P4), even for a pair whose CAPACITY_FULL exclusion a PM overrode — that pair stays a manual match.
 */
function greedyDraft(seekers: SeekerResult[], snap: MatchingSnapshot): DraftResult {
  const remaining = new Map(snap.mentors.map((m) => [m.personId, Math.max(0, m.capacity - m.load)]));
  const options = (s: SeekerResult) => s.candidates.filter((c) => c.recommendable).length;
  const order = [...seekers].sort((a, b) => options(a) - options(b) || (a.seekerId < b.seekerId ? -1 : a.seekerId > b.seekerId ? 1 : 0));
  const assignments: DraftResult["assignments"] = [];
  const unmatched: string[] = [];
  for (const s of order) {
    const pick = s.candidates.find((c) => c.recommendable && (remaining.get(c.mentorId) ?? 0) >= 1);
    if (!pick) {
      unmatched.push(s.seekerId);
      continue;
    }
    remaining.set(pick.mentorId, remaining.get(pick.mentorId)! - 1);
    assignments.push({ seekerId: s.seekerId, mentorId: pick.mentorId, rank: pick.rank, total: pick.total });
  }
  return { assignments, unmatched };
}
