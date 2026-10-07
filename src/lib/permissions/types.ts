export type Role = "org_admin" | "pm" | "assessor" | "content_manager" | "safeguarding";
export type ScopeType = "org" | "programme" | "cohort";

export interface Grant {
  role: Role;
  scopeType: ScopeType;
  scopeId: string | null;
}

/** The signed-in person, derived ONLY from the session (INV-1.5). */
export interface Actor {
  identityId: string;
  membershipId: string;
  organisationId: string;
  roles: Grant[];
  isPlatformAdmin: boolean;
  locale: "en" | "az" | "ru";
  timeZone: string;
  totpEnrolled: boolean;
  totpVerified: boolean;
  totpVerifiedAt: Date | null;
}

/** What the action is being performed on. Only fields relevant to the action need be set. */
export interface Resource {
  programmeId?: string;
  cohortId?: string;
  ownerMembershipId?: string; // "own": the record belongs to this membership
  authorMembershipId?: string; // "author"
  isMember?: boolean; // actor is a member of the relationship/team (computed by the caller from the database)
  assigned?: boolean; // e.g. assessor assigned to this application
}

/**
 * Cell conditions from the permission matrix (§3):
 *   any      allowed for the subject without further condition
 *   org      only an org-scoped grant
 *   scope    within the grant's scope (org grant covers everything; programme grant covers that programme and its cohorts)
 *   scope_pm org admin allowed ONLY if they also hold a PM grant covering the resource (D15, "S+PM")
 *   own      only the actor's own record
 *   member   actor is a member of the relationship
 *   author   actor wrote it
 *   assigned assessor assigned to the application
 *   anyscope the subject holds the role in ANY scope; for list/overview actions only — the caller MUST then filter results to the grants' scopes
 */
export type Cond = "any" | "org" | "scope" | "scope_pm" | "own" | "member" | "author" | "assigned" | "anyscope";

/** Subjects are roles plus the pseudo-subjects below. */
export type Subject = Role | "platform_admin" | "authenticated" | "participant";

export type Rules = Partial<Record<Subject, Cond | Cond[]>>;
export type PermissionMap = Record<string, Rules>;
