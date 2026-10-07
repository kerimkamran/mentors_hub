import type { PermissionMap } from "./types";

/**
 * Slice S2 rows: matrix §4.2 (people and import) and the directory (US-ADM-22). Deny by default.
 * `scope` actions need the run's or person's programme/cohort in the resource; `anyscope` actions are list/overview
 * actions whose callers MUST filter results to the actor's grants.
 */
export const peoplePermissions: PermissionMap = {
  "import.run": { org_admin: "org", pm: "scope" },
  "import.full_sync": { org_admin: "org" }, // absent people are deactivated: org admin only (matrix: deactivate = OA)
  "import.view": { org_admin: "org", pm: "scope" }, // preview, run detail, error file
  "import.list": { org_admin: "org", pm: "anyscope" },
  "people.directory.view": { org_admin: "org", pm: "anyscope" },
  "people.directory.export": { org_admin: "org", pm: "anyscope" },
  "people.record.view": { org_admin: "org", pm: "scope" },
  "people.hr.view": { org_admin: "org" }, // grade bucket and reporting line, never shown to PM in the directory (AC-ADM-22.2)
  "people.deactivate": { org_admin: "org" },
};
