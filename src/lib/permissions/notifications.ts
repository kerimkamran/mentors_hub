import type { PermissionMap } from "./types";

/**
 * Permission rows, slice S3 part 2: matrix §4.11 (operations, announcements, templates, palette, bulk) and the
 * participant notification rows (FR-MSG-003/007). Deny by default.
 */
export const notificationPermissions: PermissionMap = {
  // Notification centre: everyone, own records only.
  "notification.read.own": { authenticated: "own" },
  "notification.preference.edit.own": { authenticated: "own" },
  "appearance.edit.own": { authenticated: "own" },

  // Operations (matrix: "View job queue; retry a job" and "View email delivery log; resend").
  "ops.jobs.view": { org_admin: "org" },
  "ops.jobs.retry": { org_admin: "org" },
  "ops.jobs.platform_health": { platform_admin: "any" }, // platform-wide health only, never tenant job details
  "ops.email.view": { org_admin: "org", pm: "anyscope" }, // PM: caller filters to own programmes, status only
  "ops.email.resend": { org_admin: "org" },

  // "Preview email templates (synthetic data)": OA and content manager.
  "email.template.preview": { org_admin: "org", content_manager: "org" },

  // "Post an announcement": OA anywhere, PM inside their programme.
  "announcement.list": { org_admin: "org", pm: "anyscope" },
  "announcement.post.org": { org_admin: "org" },
  "announcement.post.programme": { org_admin: "org", pm: "scope" },

  // "Use command palette": every admin-type role, never participants.
  "palette.use": {
    platform_admin: "any",
    org_admin: "anyscope",
    pm: "anyscope",
    assessor: "anyscope",
    content_manager: "anyscope",
    safeguarding: "anyscope",
  },

  // "Run a bulk action (after preview)": each row is still permission-checked by its own action.
  "bulk.run": { org_admin: "org", pm: "anyscope" },
  "bulk.approve": { org_admin: "org" },
};
