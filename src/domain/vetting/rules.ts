/** Pure rules of the mentor-application state machine (domain model §4.1), form completeness and the re-application cool-off. */

export type ApplicationStatus = "draft" | "nominated" | "submitted" | "in_review" | "approved" | "rejected" | "withdrawn" | "suspended";
export const STATUSES: readonly ApplicationStatus[] = ["draft", "nominated", "submitted", "in_review", "approved", "rejected", "withdrawn", "suspended"];

/** Mirror of the transition list enforced by the database trigger mh_mentor_application_guard (kept equal by a test). */
export const TRANSITIONS: readonly (readonly [ApplicationStatus, ApplicationStatus])[] = [
  ["nominated", "draft"], ["nominated", "withdrawn"], ["draft", "submitted"], ["draft", "withdrawn"],
  ["submitted", "in_review"], ["submitted", "withdrawn"], ["submitted", "approved"],
  ["in_review", "approved"], ["in_review", "rejected"], ["in_review", "withdrawn"],
  ["approved", "suspended"], ["suspended", "approved"],
];
export const canTransition = (from: ApplicationStatus, to: ApplicationStatus): boolean => TRANSITIONS.some(([a, b]) => a === from && b === to);

/** Live = still occupies the person's slot in a programme (unique index: one live application per person and programme). */
export const isLive = (s: ApplicationStatus): boolean => s !== "rejected" && s !== "withdrawn";

// ---- application form ---------------------------------------------------------------------------------
export interface ApplicationForm {
  motivation: string | null;
  experience: string | null;
  mentoringExperience: string | null;
  commitmentConfirmed: boolean;
}
export const MIN_TEXT = 20;
export type FormPart = "motivation" | "experience" | "commitment";

/** Required parts that are missing or too short (AC-VET-01.3). Mentoring experience is optional. */
export function missingParts(f: ApplicationForm): FormPart[] {
  const out: FormPart[] = [];
  if ((f.motivation ?? "").trim().length < MIN_TEXT) out.push("motivation");
  if ((f.experience ?? "").trim().length < MIN_TEXT) out.push("experience");
  if (!f.commitmentConfirmed) out.push("commitment");
  return out;
}

// ---- re-application cool-off (C-151, AC-PRG-03.4) --------------------------------------------------------
export function reapplyAvailableFrom(closedAt: Date, cooloffDays: number): Date {
  return new Date(closedAt.getTime() + cooloffDays * 24 * 60 * 60 * 1000);
}
/** 0 days means immediately; otherwise blocked until the returned date (shown to the applicant neutrally). */
export function cooloffBlocks(closedAt: Date | null, cooloffDays: number, now: Date): Date | null {
  if (!closedAt || cooloffDays <= 0) return null;
  const until = reapplyAvailableFrom(closedAt, cooloffDays);
  return now < until ? until : null;
}
