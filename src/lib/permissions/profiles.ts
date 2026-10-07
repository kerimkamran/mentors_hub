import type { PermissionMap } from "./types";

/**
 * Slice S4 rows: matrix §4.4 (profiles, goals, availability) and the taxonomy edit row of §4.3.
 * `profile.read.own` and `profile.edit.own` already exist in core.ts (S1) and are reused as they are.
 *
 * "participant" cells mean any signed-in person as far as THIS map can tell: whether they may read a particular field is
 * decided from the database (shared programme, relationship, field visibility), never from the request (src/domain/profiles/viewer.ts).
 */
export const profilePermissions: PermissionMap = {
  // Another person's profile: participants through per-field visibility; PM within scope sees basics only.
  "profile.read.other": { participant: "any", pm: "anyscope" },
  "profile.read.basic": { pm: "scope" },

  // Own availability, capacity, blocks, goals (matrix §4.4: "Edit own profile, visibility, availability").
  "availability.read.own": { authenticated: "own" },
  "availability.edit.own": { authenticated: "own" },
  "capacity.set.own": { authenticated: "own" },
  "capacity.alerts.read": { pm: "scope", org_admin: "scope_pm" },
  "block.manage.own": { authenticated: "own" },
  "goal.read.own": { authenticated: "own" },
  "goal.edit.own": { authenticated: "own" },
  // PM: tags and status only (the function also drops goals set to "Only me").
  "goal.read.pm_summary": { pm: "scope" },

  // Taxonomy overrides (matrix §4.3: org admin, content manager).
  "taxonomy.edit": { org_admin: "org", content_manager: "org" },
  "taxonomy.read": { authenticated: "any" },
};
