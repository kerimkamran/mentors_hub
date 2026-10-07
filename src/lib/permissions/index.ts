import { corePermissions } from "./core";
import { peoplePermissions } from "./people";
import { programmePermissions } from "./programmes";
import { notificationPermissions } from "./notifications";
import { profilePermissions } from "./profiles";
import { vettingPermissions } from "./vetting";
import type { Actor, Cond, Grant, PermissionMap, Resource, Subject } from "./types";

export * from "./types";

/** Merge every slice's map here. Duplicate action ids are a build error (tested). */
export const PERMISSION_SOURCES: PermissionMap[] = [
  corePermissions,
  peoplePermissions,
  programmePermissions,
  notificationPermissions,
  profilePermissions,
  vettingPermissions,
];

export const PERMISSIONS: PermissionMap = Object.assign({}, ...PERMISSION_SOURCES);

/** Thrown for every denial. Callers map it to the framework's "not found" response (INV-4.3). */
export class NotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super("not found");
  }
}

function scopeCovers(g: Grant, r: Resource): boolean {
  if (g.scopeType === "org") return true;
  if (g.scopeType === "programme") return !!r.programmeId && g.scopeId === r.programmeId;
  return !!r.cohortId && g.scopeId === r.cohortId;
}

function holds(actor: Actor, role: Grant["role"], r: Resource): boolean {
  return actor.roles.some((g) => g.role === role && scopeCovers(g, r));
}

function condOk(cond: Cond, actor: Actor, r: Resource, g?: Grant): boolean {
  switch (cond) {
    case "any":
      return true;
    case "org":
      return g?.scopeType === "org";
    case "scope":
      return g ? scopeCovers(g, r) : false;
    case "scope_pm":
      return !!g && scopeCovers(g, r) && holds(actor, "pm", r);
    case "own":
      return !!r.ownerMembershipId && r.ownerMembershipId === actor.membershipId;
    case "member":
      return r.isMember === true;
    case "author":
      return !!r.authorMembershipId && r.authorMembershipId === actor.membershipId;
    case "assigned":
      return r.assigned === true;
    case "anyscope":
      return !!g;
  }
}

const list = (c: Cond | Cond[] | undefined): Cond[] => (c === undefined ? [] : Array.isArray(c) ? c : [c]);

/** The ONE authorisation function (INV-4.1). Pure; no database access. */
export function can(actor: Actor, action: string, resource: Resource = {}): boolean {
  const rules = PERMISSIONS[action];
  if (!rules) return false; // unknown action ⇒ deny (INV-8.5)
  const subjects = Object.keys(rules) as Subject[];
  for (const subject of subjects) {
    const conds = list(rules[subject]);
    if (subject === "platform_admin") {
      if (actor.isPlatformAdmin && conds.some((c) => condOk(c, actor, resource))) return true;
    } else if (subject === "authenticated" || subject === "participant") {
      // `participant` membership is evaluated by the caller (isMember etc.); here any signed-in actor is a candidate.
      if (conds.some((c) => condOk(c, actor, resource))) return true;
    } else {
      for (const g of actor.roles.filter((x) => x.role === subject)) {
        if (conds.some((c) => condOk(c, actor, resource, g))) return true;
      }
    }
  }
  return false;
}

/** Throws NotFoundError on denial. Use at the top of every server action and id-taking page. */
export function authorize(actor: Actor, action: string, resource: Resource = {}): void {
  let ok = false;
  try {
    ok = can(actor, action, resource);
  } catch {
    ok = false; // INV-8.5: if the gate itself throws, deny
  }
  if (!ok) throw new NotFoundError();
}

export const hasRole = (actor: Actor, role: Grant["role"]) => actor.roles.some((g) => g.role === role);
export const isOrgAdmin = (actor: Actor) => actor.roles.some((g) => g.role === "org_admin" && g.scopeType === "org");
