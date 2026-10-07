import type { Tx } from "@/lib/db";
import { NotFoundError, type Actor, type Resource } from "@/lib/permissions";
import type { ApplicationStatus } from "./rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

export interface AppRow {
  id: string;
  programme_id: string;
  membership_id: string;
  status: ApplicationStatus;
  source: "applied" | "nominated";
  nominated_by: string | null;
  rubric_version_id: string | null;
  motivation: string | null;
  experience: string | null;
  mentoring_experience: string | null;
  commitment_confirmed: boolean;
  submitted_at: Date | null;
  decision: "approved" | "rejected" | null;
  decision_basis: "rubric" | "open_exception" | null;
  advisory_outcome: "approve" | "borderline" | "reject" | null;
  advisory_total: string | null;
  decision_reason_differs_flag: boolean;
  decision_reason: string | null;
  decided_at: Date | null;
  suspended_at: Date | null;
  suspension_reason: string | null;
  closed_at: Date | null;
  created_at: Date;
}

/** Loads an application by id inside the organisation context (RLS hides other organisations). Invalid ids are "not found". */
export async function loadApp(tx: Tx, id: string, forUpdate = false): Promise<AppRow | null> {
  if (!isUuid(id)) return null;
  const r = await tx.query<AppRow>(`SELECT * FROM mentor_application WHERE id = $1${forUpdate ? " FOR UPDATE" : ""}`, [id]);
  return r.rows[0] ?? null;
}

export const orNotFound = <T>(x: T | null | undefined): T => {
  if (x === null || x === undefined) throw new NotFoundError();
  return x;
};

export const appResource = (app: Pick<AppRow, "programme_id" | "membership_id">, extra: Partial<Resource> = {}): Resource => ({
  programmeId: app.programme_id,
  ownerMembershipId: app.membership_id,
  ...extra,
});

/** Programmes the actor manages as PM: null = all (organisation-wide grant), otherwise the list of programme ids. */
export function managedProgrammes(actor: Actor): string[] | null {
  const grants = actor.roles.filter((g) => g.role === "pm");
  if (grants.some((g) => g.scopeType === "org")) return null;
  return grants.filter((g) => g.scopeType === "programme" && g.scopeId).map((g) => g.scopeId!);
}

/** A person never acts as PM on their own application (self-dealing is "not found"). */
export function notOwnApplication(actor: Actor, app: Pick<AppRow, "membership_id">): void {
  if (app.membership_id === actor.membershipId) throw new NotFoundError();
}

/** Does the person in `membershipId` hold an assessor role covering the programme (organisation-wide, programme or one of its cohorts)? */
export async function holdsAssessorRole(tx: Tx, membershipId: string, programmeId: string): Promise<boolean> {
  const r = await tx.query(
    `SELECT 1 FROM role_grant g
     WHERE g.membership_id = $1 AND g.role = 'assessor'
       AND (g.scope_type = 'org'
         OR (g.scope_type = 'programme' AND g.scope_id = $2)
         OR (g.scope_type = 'cohort' AND EXISTS (SELECT 1 FROM cohort c WHERE c.id = g.scope_id AND c.programme_id = $2)))
     LIMIT 1`,
    [membershipId, programmeId],
  );
  return (r.rowCount ?? 0) > 0;
}
