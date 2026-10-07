import type { PermissionMap } from "./types";

/**
 * Slice S3 rows: matrix §4.3 (programmes, settings, flags, templates) and the organisation-level settings of §4.1.
 * Programme actions take `{ programmeId }`; a PM's programme grant covers only that programme (denied reads look like missing records).
 */
export const programmePermissions: PermissionMap = {
  "programme.list": { org_admin: "org", pm: "anyscope" }, // PM: the caller filters to the programmes in their grants
  "programme.create": { org_admin: "org" }, // PM creating programmes is PROPOSED only (OQ-B1-24): denied
  "programme.read": { org_admin: "org", pm: "scope", content_manager: "scope" },
  "programme.read.summary": { participant: "member" }, // participants see rules, never weights or factors
  "programme.config.edit": { org_admin: "org", pm: "scope" }, // name, enrolment, eligibility, sponsors, questionnaire, cohorts
  "programme.activate": { org_admin: "org", pm: "scope" },
  "programme.close": { org_admin: "org", pm: "scope" },

  "programme.settings.read": { org_admin: "org", pm: "scope" },
  "programme.settings.edit": { org_admin: "org", pm: "scope" },
  "programme.settings.history": { org_admin: "org", pm: "scope" },
  "programme.settings.restore": { org_admin: "org", pm: "scope" },
  "programme.settings.export": { org_admin: "org", pm: "scope" },
  "programme.settings.import": { org_admin: "org", pm: "scope" },
  "programme.flags.edit": { org_admin: "org", pm: "scope" }, // programme-level flags only
  "programme.template.save": { org_admin: "org", pm: "scope" },
  "programme.template.list": { org_admin: "org", pm: "anyscope" },

  // Organisation-level settings centre (SCR-22). PMs never see it. Flags/localisation reuse `org.settings.change` (core).
  "org.settings.read": { org_admin: "org" },
  "org.settings.history": { org_admin: "org" },
  "org.settings.restore": { org_admin: "org" },
  "org.security.change": { org_admin: "org" }, // also needs an authenticator code at save (AC-TEN-04.5)
  "org.brand.change": { org_admin: "org" },
  "org.prerequisite.record": { org_admin: "org" }, // DPIA sign-off, storage approval
};
