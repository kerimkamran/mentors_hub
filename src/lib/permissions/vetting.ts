import type { PermissionMap } from "./types";

/**
 * Permission rows, slice S5: matrix §4.5 (mentor vetting) and the rubric row of §4.7.
 * "S aud" cells are PM-with-scope actions that are audited by the command. Org admins hold no vetting action (matrix: –).
 * Assessor rows use `assigned`, computed by the caller from the assessment table, never from the request.
 */
export const vettingPermissions: PermissionMap = {
  "vetting.application.nominate": { pm: "scope" },
  // Start, edit, submit, withdraw, accept or decline my own application. Eligibility is checked from the database.
  "vetting.application.apply": { authenticated: "own" },
  "vetting.application.read": { pm: "scope", assessor: "assigned", authenticated: "own" },
  "vetting.application.list": { pm: "anyscope" }, // results are filtered to the PM's own scopes by the caller
  "vetting.assessor.assign": { pm: "scope" },
  "vetting.assessment.list.own": { assessor: "anyscope" }, // filtered to assessments assigned to the actor
  "vetting.assessment.submit": { assessor: "assigned" }, // also covers autosave
  // Other assessors' scores: an assigned assessor after submitting their own; a PM after all are submitted (checked by the query).
  "vetting.assessment.read.others": { pm: "scope", assessor: "assigned" },
  "vetting.decision.record": { pm: "scope" },
  "vetting.decision.release": { pm: "scope" },
  "vetting.decision.read": { pm: "scope", authenticated: "own" }, // the applicant's own view hides scores, assessors and reasons
  "vetting.mentor.suspend": { pm: "scope" }, // suspend, reinstate, see flagged relationships

  "vetting.rubric.version": { org_admin: "org", content_manager: "org" },
};
