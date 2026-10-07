import { defaultMatchingSettings } from "@/domain/matching/settings";
import type {
  AvailabilityRule,
  MatchingSettings,
  MatchingSnapshot,
  MemberInput,
  MentorInput,
  ProgrammeType,
  SeekerGoal,
  SeekerInput,
  TaxonomyTag,
} from "@/domain/matching/types";

/** "Reference Telecom" fixtures (matching-spec §8.1). */

export const ORG = "org-reference-telecom";

const lab = (en: string, az: string, ru: string) => ({ en, az, ru });

export const TAXONOMY: TaxonomyTag[] = [
  { id: "leadership", parentId: null, canonicalId: null, labels: lab("Leadership", "Liderlik", "Лидерство") },
  { id: "strategy", parentId: "leadership", canonicalId: null, labels: lab("Strategy", "Strategiya", "Стратегия") },
  { id: "people-management", parentId: "leadership", canonicalId: null, labels: lab("People management", "Kadr idarəetməsi", "Управление людьми") },
  { id: "mgmt", parentId: null, canonicalId: "people-management", labels: lab("Management", "İdarəetmə", "Менеджмент") },
  { id: "data", parentId: null, canonicalId: null, labels: lab("Data", "Data", "Данные") },
  { id: "ml", parentId: "data", canonicalId: null, labels: lab("Machine learning", "Maşın öyrənməsi", "Машинное обучение") },
  { id: "sql", parentId: "data", canonicalId: null, labels: lab("SQL", "SQL", "SQL") },
  { id: "finance", parentId: null, canonicalId: null, labels: lab("Finance", "Maliyyə", "Финансы") },
];

export const INTERESTS = [
  { id: "running", labels: lab("running", "qaçış", "бег") },
  { id: "chess", labels: lab("chess", "şahmat", "шахматы") },
  { id: "music", labels: lab("music", "musiqi", "музыка") },
];

export const rule = (weekday: AvailabilityRule["weekday"], startMinute: number, endMinute: number): AvailabilityRule => ({ weekday, startMinute, endMinute, validFrom: null, validTo: null });
/** Monday–Friday 10:00–12:00. */
export const WEEKDAYS_AM: AvailabilityRule[] = [1, 2, 3, 4, 5].map((d) => rule(d as AvailabilityRule["weekday"], 600, 720));

export const AS_OF = "2026-10-05"; // a Monday

export function member(personId: string, o: Partial<MemberInput> = {}): MemberInput {
  return {
    personId,
    eligible: true,
    gradeBucket: 2,
    reporting: { managerId: null, skipLevelId: null },
    languages: [
      { language: "az", level: "fluent" },
      { language: "en", level: "fluent" },
    ],
    interests: null,
    availability: WEEKDAYS_AM,
    compat: null,
    ...o,
  };
}

export function mentee(id: string, o: { goals?: SeekerGoal[]; member?: Partial<MemberInput>; accepted?: number; pending?: number } = {}): SeekerInput {
  return {
    id,
    kind: "mentee",
    organisationId: ORG,
    members: [member(id, o.member)],
    leadPersonId: id,
    goals: o.goals ?? [],
    neededExpertise: [],
    phase: null,
    acceptedMatches: o.accepted ?? 0,
    pendingMatches: o.pending ?? 0,
  };
}

export function team(id: string, memberIds: string[], lead: string, o: { needed?: string[]; phase?: SeekerInput["phase"]; members?: Record<string, Partial<MemberInput>> } = {}): SeekerInput {
  return {
    id,
    kind: "team",
    organisationId: ORG,
    members: memberIds.map((m) => member(m, o.members?.[m])),
    leadPersonId: lead,
    goals: [],
    neededExpertise: o.needed ?? [],
    phase: o.phase ?? null,
    acceptedMatches: 0,
    pendingMatches: 0,
  };
}

export function mentor(id: string, o: Partial<MentorInput> = {}): MentorInput {
  return {
    personId: id,
    organisationId: ORG,
    approved: true,
    eligible: true,
    minimumProfile: true,
    browsableWithoutMinimumProfile: false,
    capacity: 2,
    load: 0,
    topics: [{ tagId: "strategy", depth: "expert" }],
    phases: [],
    gradeBucket: 3,
    reporting: { managerId: null, skipLevelId: null },
    languages: [
      { language: "az", level: "fluent" },
      { language: "en", level: "fluent" },
    ],
    interests: null,
    availability: WEEKDAYS_AM,
    compat: null,
    visible: { topics: true, availability: true, languages: true, interests: true, questionnaire: true },
    ...o,
  };
}

export const goal = (id: string, tags: string[], primary = false, sharedTitle?: string): SeekerGoal => ({ id, primary, tags, ...(sharedTitle ? { sharedTitle } : {}) });

export function snapshot(type: ProgrammeType, seekers: SeekerInput[], mentors: MentorInput[], o: Partial<MatchingSnapshot> = {}): MatchingSnapshot {
  return {
    organisationId: ORG,
    programme: { id: `prog-${type}`, type, asOf: AS_OF },
    taxonomy: TAXONOMY,
    interestCatalogue: INTERESTS,
    questionnaire: [],
    seekers,
    mentors,
    blocks: [],
    history: [],
    overrides: [],
    ...o,
  };
}

export function settings(type: ProgrammeType, patch: (s: MatchingSettings) => void = () => {}, versionId = `test-${type}`): MatchingSettings {
  const s = defaultMatchingSettings(type, versionId);
  patch(s);
  return s;
}

/** Settings with only the named criteria weighted (weights re-balanced to total 100) and all optional exclusions off. */
export function bareSettings(type: ProgrammeType, weights: Partial<MatchingSettings["weights"]>): MatchingSettings {
  return settings(type, (s) => {
    s.weights = { goal: 0, expertise: 0, availability: 0, career: 0, language: 0, interests: 0, other: 0, ...weights };
    for (const k of Object.keys(s.exclusions) as (keyof typeof s.exclusions)[]) s.exclusions[k] = k === "SAME_PERSON" || k === "BLOCKED" || k === "NOT_APPROVED";
  });
}
