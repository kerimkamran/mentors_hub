/**
 * Mentor capacity per programme (US-PRF-03, AC-PRF-03.2, C-021).
 * A mentor sets their own capacity up to the programme maximum. Lowering it below their current load is allowed but flags the
 * PM ("mentor over capacity"): the change is audited by id, the caller is told, and the flag is derivable at any time with
 * listOverCapacityMentors. Notification wiring (S3/S10) plugs into CapacityDeps.onBelowLoad.
 */
import { audit } from "@/lib/audit";
import { withOrg } from "@/lib/db";
import { authorize, NotFoundError, type Actor } from "@/lib/permissions";
import { isUuid, ValidationError } from "../profiles/errors";
import { capacityLimits } from "../profiles/settings";
import { mentorCapacities } from "./queries";

export interface BelowLoadEvent {
  organisationId: string;
  programmeId: string;
  participationId: string;
  mentorMembershipId: string;
}

export interface CapacityDeps {
  /** Called inside the transaction when a mentor lowers capacity below their load. Default: nothing (the audit entry and the live query carry the flag). */
  onBelowLoad: (e: BelowLoadEvent) => Promise<void>;
}
const defaultDeps: CapacityDeps = { onBelowLoad: async () => undefined };

export interface CapacityResult {
  capacity: number;
  load: number;
  maximum: number;
  /** True when the new capacity is below the current load: the PM must be told (AC-PRF-03.2). */
  belowLoad: boolean;
}

export async function setMentorCapacity(actor: Actor, input: { participationId: string; capacity: number }, deps: CapacityDeps = defaultDeps): Promise<CapacityResult> {
  authorize(actor, "capacity.set.own", { ownerMembershipId: actor.membershipId });
  if (!isUuid(input.participationId)) throw new NotFoundError();
  if (!Number.isInteger(input.capacity) || input.capacity < 0) throw new ValidationError("capacity.invalid");
  return withOrg(actor.organisationId, async (tx) => {
    const rows = await mentorCapacities(tx, actor.membershipId);
    const row = rows.find((r) => r.participationId === input.participationId);
    if (!row) throw new NotFoundError(); // not my mentor participation: indistinguishable from a missing one
    const limits = await capacityLimits(tx, row.programmeType);
    if (input.capacity > limits.maximum) throw new ValidationError("capacity.above_maximum");
    await tx.query("UPDATE participation SET capacity = $2 WHERE id = $1", [row.participationId, input.capacity]);
    const belowLoad = input.capacity < row.load;
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "capacity.set", objectType: "participation", objectId: row.participationId });
    if (belowLoad) {
      await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "capacity.below_load", objectType: "participation", objectId: row.participationId });
      await deps.onBelowLoad({ organisationId: actor.organisationId, programmeId: row.programmeId, participationId: row.participationId, mentorMembershipId: actor.membershipId });
    }
    return { capacity: input.capacity, load: row.load, maximum: limits.maximum, belowLoad };
  });
}

export interface OverCapacityRow {
  participationId: string;
  mentorMembershipId: string;
  programmeId: string;
  capacity: number;
  load: number;
}

/** The PM item "mentor over capacity": mentors in one programme whose load exceeds their own capacity. Status and numbers only. */
export async function listOverCapacityMentors(actor: Actor, programmeId: string): Promise<OverCapacityRow[]> {
  authorize(actor, "capacity.alerts.read", { programmeId });
  if (!isUuid(programmeId)) throw new NotFoundError();
  return withOrg(actor.organisationId, async (tx) => {
    const r = await tx.query<{ id: string; membership_id: string; programme_id: string; capacity: number; load: number }>(
      `SELECT p.id, p.membership_id, c.programme_id, p.capacity,
              (SELECT count(DISTINCT rm.relationship_id)::int FROM relationship_member rm
                 JOIN relationship rel ON rel.id = rm.relationship_id AND rel.organisation_id = rm.organisation_id
                WHERE rm.participation_id = p.id AND rm.role = 'mentor' AND rel.status IN ('active', 'paused')) AS load
         FROM participation p JOIN cohort c ON c.id = p.cohort_id AND c.organisation_id = p.organisation_id
        WHERE c.programme_id = $1 AND p.kind = 'mentor' AND p.status <> 'withdrawn' AND p.capacity IS NOT NULL`,
      [programmeId],
    );
    return r.rows.filter((x) => x.load > x.capacity).map((x) => ({ participationId: x.id, mentorMembershipId: x.membership_id, programmeId: x.programme_id, capacity: x.capacity, load: x.load }));
  });
}
