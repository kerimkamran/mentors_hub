/**
 * Availability writes (US-PRF-03). Own data only; existing sessions are never touched by anything here (AC-PRF-03.4):
 * this module has no access to bookings other than reading them as busy time.
 */
import { withOrg } from "@/lib/db";
import { authorize, NotFoundError, type Actor } from "@/lib/permissions";
import { isUuid, ValidationError } from "../profiles/errors";
import { validateRule } from "./slots";
import { isValidTimeZone, parseHm } from "./tz";

export type RuleKind = "rule" | "window";
const TABLE: Record<RuleKind, string> = { rule: "availability_rule", window: "availability_window" };
export const MAX_RULES_PER_PERSON = 40;

export interface RuleInput {
  weekday: number;
  start: string;
  end: string;
  timeZone: string;
  validFrom?: string | null;
  validTo?: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const own = (actor: Actor) => authorize(actor, "availability.edit.own", { ownerMembershipId: actor.membershipId });

export async function addAvailability(actor: Actor, kind: RuleKind, input: RuleInput): Promise<string> {
  own(actor);
  if (!(kind in TABLE)) throw new ValidationError("availability.kind");
  if (!isValidTimeZone(input.timeZone)) throw new ValidationError("availability.time_zone");
  const bad = validateRule({ ...input });
  if (bad) throw new ValidationError(`availability.${bad}`);
  for (const d of [input.validFrom, input.validTo]) if (d && (!DATE.test(d) || Number.isNaN(Date.parse(d)))) throw new ValidationError("availability.validity");
  const table = TABLE[kind];
  return withOrg(actor.organisationId, async (tx) => {
    const n = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE membership_id = $1`, [actor.membershipId]);
    if (n.rows[0]!.n >= MAX_RULES_PER_PERSON) throw new ValidationError("availability.too_many");
    const r = await tx.query<{ id: string }>(
      `INSERT INTO ${table} (organisation_id, membership_id, weekday, start_time, end_time, time_zone, valid_from, valid_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [actor.organisationId, actor.membershipId, input.weekday, minutesToTime(parseHm(input.start)), minutesToTime(parseHm(input.end)), input.timeZone, input.validFrom || null, input.validTo || null],
    );
    return r.rows[0]!.id;
  });
}

const minutesToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export async function removeAvailability(actor: Actor, kind: RuleKind, id: string): Promise<void> {
  own(actor);
  if (!(kind in TABLE) || !isUuid(id)) throw new NotFoundError();
  await withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query(`DELETE FROM ${TABLE[kind]} WHERE id = $1 AND membership_id = $2`, [id, actor.membershipId]);
    if (!r.rowCount) throw new NotFoundError(); // someone else's rule looks exactly like a missing one
  });
}

/** An away period (holiday, leave): slots overlapping it are not offered. */
export async function addException(actor: Actor, input: { startsAt: Date; endsAt: Date }): Promise<string> {
  own(actor);
  if (!(input.endsAt > input.startsAt) || Number.isNaN(input.startsAt.getTime()) || Number.isNaN(input.endsAt.getTime())) throw new ValidationError("availability.range");
  return withOrg(actor.organisationId, async (tx) => {
    const n = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM availability_exception WHERE membership_id = $1 AND ends_at > now()", [actor.membershipId]);
    if (n.rows[0]!.n >= MAX_RULES_PER_PERSON) throw new ValidationError("availability.too_many");
    const r = await tx.query<{ id: string }>(
      "INSERT INTO availability_exception (organisation_id, membership_id, starts_at, ends_at) VALUES ($1, $2, $3, $4) RETURNING id",
      [actor.organisationId, actor.membershipId, input.startsAt, input.endsAt],
    );
    return r.rows[0]!.id;
  });
}

export async function removeException(actor: Actor, id: string): Promise<void> {
  own(actor);
  if (!isUuid(id)) throw new NotFoundError();
  await withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query("DELETE FROM availability_exception WHERE id = $1 AND membership_id = $2", [id, actor.membershipId]);
    if (!r.rowCount) throw new NotFoundError();
  });
}
