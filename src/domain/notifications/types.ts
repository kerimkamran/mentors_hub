import type { Tx } from "@/lib/db";
import type { Grant } from "@/lib/permissions";
import type { Locale } from "./format";

export type { Locale };

/**
 * What a template parameter may carry. There is deliberately NO kind for free text (R2, INV-3): a template can show
 * names, counts, dates, words from a fixed vocabulary, its own link and the sign-in code, and nothing else.
 */
export type ParamKind = "name" | "count" | "date" | "datetime" | "code" | "token";

export type ParamValue = string | number | Date;
export type Params = Record<string, ParamValue>;

/** The person a notification is for, loaded from the database (never from a request). */
export interface Recipient {
  membershipId: string;
  identityId: string;
  email: string;
  locale: Locale;
  timeZone: string;
  roles: Grant[];
  isPlatformAdmin: boolean;
  status: "active" | "inactive" | "invited";
}

export interface ResolveCtx {
  tx: Tx;
  organisationId: string;
  recipient: Recipient;
  subjectId: string;
  actorId: string | null;
}

export type Messages = Record<string, string>;

/**
 * One notification of the catalogue (one file per template under templates/). Adding a template means: create
 * templates/n-nnn.ts exporting a TemplateDef and add ONE line to templates/index.ts. See docs/NOTIFICATIONS.md.
 */
export interface TemplateDef {
  /** Catalogue id, e.g. "N-011". */
  code: string;
  /** English catalogue name (documentation and admin picker). */
  name: string;
  /** Slice that owns the template. */
  slice: string;
  /** Critical templates cannot be switched off (R8). */
  critical: boolean;
  /** R7: email and/or in-app. */
  channels: { email: boolean; inApp: boolean };
  /** Who receives it (documentation of the catalogue rule; the caller of notify() picks the recipients). */
  recipients: string;
  /** Object type stored in notification.subject_type. */
  subjectType: string;
  /**
   * `direct` templates are rendered by their own job from a short-lived payload (the sign-in email); they never
   * create a notification row, so notify() refuses them.
   */
  direct?: boolean;
  /** Membership statuses that may receive it. Default: active only (an invitation is sent to an invited person). */
  recipientStatuses?: Recipient["status"][];
  /** Declared parameters and their kinds; the renderer rejects anything else. */
  params: Record<string, ParamKind>;
  /** Placeholders the SUBJECT line may use. Default none: subjects are generic (R4). */
  subjectParams?: string[];
  /** Translations. Keys: `subject`, `body` (email) and `inapp` (in-app text), as the channels require. */
  messages: Partial<Record<Locale, Messages>>;
  /** Link target: a PAGE path (R3). Never an action; the page offers the button. */
  link: (subjectId: string, params: Params) => string;
  /**
   * Loads the display parameters for THIS recipient, or returns null when the recipient may not see the object
   * (R6) or it no longer exists. Used when notifying, when sending and when listing.
   */
  resolve: (ctx: ResolveCtx) => Promise<Params | null>;
  /** Synthetic fixtures for the admin preview (US-ADM-17); never read from the database. */
  sample: { subjectId: string; params: Params };
  /** Content limits from the catalogue: names and links only, bounded length. */
  limits: { subjectMaxChars: number; bodyMaxChars: number };
}
