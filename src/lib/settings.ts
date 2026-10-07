import { DEFAULTS } from "./constants";
import { withOrg } from "./db";
import { getEffectiveSettings } from "../domain/settings/access";

export {
  getEffectiveSettings, getMatchingSettings, getEffectiveFlags, getCadenceDays,
  type EffectiveSettings, type EffectiveFlags,
} from "../domain/settings/access";
export type { SettingsScope, GroupId } from "../domain/settings/types";

export interface SecuritySettings {
  linkLifetimeMinutes: number;
  codeAttempts: number;
  sessionIdleMinutes: number;
  sessionAbsoluteDays: number;
  rateWindowMinutes: number;
  rateRequestsPerEmail: number;
  rateRequestsPerBrowser: number;
}

/**
 * The organisation's sign-in and session security settings (FR-TEN-016): the newest `security` settings version, or the
 * starting defaults when none was saved. Applies to NEW sign-ins and sessions (AC-TEN-04.3): callers read it when they
 * issue a link or a session, and existing sessions keep the expiry they were issued with. Fail closed: if the stored values
 * cannot be read the error propagates and the caller denies.
 */
export async function securitySettings(organisationId: string): Promise<SecuritySettings> {
  const { values } = await withOrg(organisationId, (tx) => getEffectiveSettings(tx, { type: "organisation" }, "security"));
  return {
    linkLifetimeMinutes: values.linkLifetimeMinutes,
    codeAttempts: values.codeAttempts,
    sessionIdleMinutes: values.sessionIdleMinutes,
    sessionAbsoluteDays: values.sessionAbsoluteDays,
    rateWindowMinutes: values.rateWindowMinutes ?? DEFAULTS.rateWindowMinutes,
    rateRequestsPerEmail: values.rateRequestsPerEmail,
    rateRequestsPerBrowser: values.rateRequestsPerBrowser,
  };
}
