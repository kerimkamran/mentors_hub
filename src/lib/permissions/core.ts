import type { PermissionMap } from "./types";

/**
 * Permission map, slice S1 rows: matrix §4.1 (tenancy, identity, settings) and §4.11 (audit).
 * Deny by default: an action absent from the map, or a subject absent from a rule, is denied.
 * Each later slice adds its own file next to this one and registers it in ./index.ts.
 */
export const corePermissions: PermissionMap = {
  "org.read": { platform_admin: "any", org_admin: "org", pm: "scope" },
  "org.settings.change": { org_admin: "org" },
  "org.residency.signoff": { org_admin: "org" },
  "org.safeguarding_contact.name": { org_admin: "org" },

  "role.grant.org_admin": { org_admin: "org" },
  "role.grant.pm": { org_admin: "org" },
  "role.grant.assessor": { org_admin: "org", pm: "scope" },
  "role.grant.content_manager": { org_admin: "org" },
  "role.grant.safeguarding": { org_admin: "org" },
  "role.list": { org_admin: "org", pm: "anyscope" }, // PM: results are filtered to their own scope

  "totp.enrol": { org_admin: "org", platform_admin: "any" },

  "audit.view": { org_admin: "org", pm: "scope" },
  "audit.export": { org_admin: "org" },

  "profile.read.own": { authenticated: "own" },
  "profile.edit.own": { authenticated: "own" },
  "consent.record.own": { authenticated: "own" },
  "session.manage.own": { authenticated: "own" },
};
