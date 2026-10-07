/**
 * Slice S4 constants. Admin-managed numbers (constants §0) are STARTING DEFAULTS read through
 * ./settings.ts accessors; S3's settings registry later replaces the bodies, not the callers.
 */
export const VISIBILITY_LEVELS = ["only_me", "programme_counterparts", "request_or_match"] as const;
export type VisibilityLevel = (typeof VISIBILITY_LEVELS)[number];

/** Profile fields that carry their own visibility setting (FR-PRF-001). Goals carry theirs per goal (FR-GOL-005). */
export const VISIBILITY_FIELDS = [
  "name", "department", "job_title", "headline", "bio", "languages", "interests", "topics_offered", "topics_sought", "availability",
] as const;
export type VisibilityField = (typeof VISIBILITY_FIELDS)[number];

/** OQ-B1-19 / matrix §5: "Only me" for everything except name and department. */
export const DEFAULT_LEVEL: Record<VisibilityField, VisibilityLevel> = {
  name: "programme_counterparts",
  department: "programme_counterparts",
  job_title: "only_me",
  headline: "only_me",
  bio: "only_me",
  languages: "only_me",
  interests: "only_me",
  topics_offered: "only_me",
  topics_sought: "only_me",
  availability: "only_me",
};

/** The fields the matching engine can read (matching-spec §1.1), when the owner allows them. Goals are listed separately. */
export const ENGINE_FIELDS = ["topics_offered", "topics_sought", "languages", "interests", "availability"] as const satisfies readonly VisibilityField[];
export type EngineField = (typeof ENGINE_FIELDS)[number];

export const DEPTHS = ["working", "advanced", "expert"] as const;
export type Depth = (typeof DEPTHS)[number];
export const PROFICIENCIES = ["working", "fluent"] as const;
export type Proficiency = (typeof PROFICIENCIES)[number];

/** Languages a person can record (ISO 639-1). Display names come from Intl.DisplayNames in the viewer's language. */
export const LANGUAGE_CODES = ["az", "en", "ru", "tr", "ka", "fa", "ar", "de", "fr", "es", "it", "zh", "uk", "he"] as const;

export const BIO_MAX = 2000;
export const HEADLINE_MAX = 160;
export const MAX_TOPICS_PER_ROLE = 40;
export const MAX_GOAL_TAGS = 10;
export const MAX_GOAL_TITLE = 200;

/** Default session length used for previews of generated slots (the booking slice owns real durations). */
export const PREVIEW_SESSION_MINUTES = 45;
export const PREVIEW_WEEKS = 2;
