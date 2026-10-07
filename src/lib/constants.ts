/**
 * Default values for constants that the spec marks as admin-managed settings (constants §0).
 * These are STARTING DEFAULTS only. The settings centre (S3) overrides them per organisation or
 * programme with bounds-checked, versioned settings; code must read them through src/lib/settings.
 */
export const DEFAULTS = {
  codeLength: 6, // C-040
  linkLifetimeMinutes: 15, // C-041
  codeAttempts: 5, // C-042
  sessionIdleMinutes: 8 * 60, // C-043 (idle)
  sessionAbsoluteDays: 30, // C-043 (absolute)
  rateWindowMinutes: 15, // C-046
  rateRequestsPerEmail: 5, // C-046
  rateRequestsPerBrowser: 30, // C-046
  defaultTimeZone: "Asia/Baku", // C-110
  stepUpMinutes: 15, // admin step-up freshness (FR-ADM-018)
} as const;

/** Platform-enforced bounds for the admin-managed security settings (constants §0). */
export const SECURITY_BOUNDS = {
  linkLifetimeMinutes: { min: 5, max: 30 },
  codeAttempts: { min: 3, max: 10 },
  sessionIdleMinutes: { min: 15, max: 24 * 60 },
  sessionAbsoluteDays: { min: 1, max: 90 },
} as const;

export const LOCALES = ["en", "az", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

/** Current privacy-notice version. Bumping it forces re-acceptance at next sign-in (AC-TEN-03.2). */
export const PRIVACY_NOTICE_VERSION = "v1";
export const AI_CONSENT_VERSION = "v1";
export * from "./constants-programmes";
