import type { Task } from "graphile-worker";
import { withOrg } from "../../src/lib/db";
import { notify } from "../../src/domain/notifications/notify";

/**
 * notify.fire: a scheduled reminder or nudge coming due. It goes through notify(), which re-checks that the recipient
 * can still see the object, so a reminder for something that was cancelled or answered drops out silently.
 */
export const notifyFire: Task = async (payload, helpers) => {
  const p = payload as { organisationId: string; template: string; recipientId: string; subjectId: string; programmeId?: string | null; actorId?: string | null; dedupeKey?: string };
  const r = await withOrg(p.organisationId, (tx) =>
    notify(tx, {
      organisationId: p.organisationId,
      template: p.template,
      recipientId: p.recipientId,
      subjectId: p.subjectId,
      programmeId: p.programmeId ?? null,
      actorId: p.actorId ?? null,
      dedupeKey: p.dedupeKey,
    }),
  );
  helpers.logger.info(`notify.fire ${r.status}`);
};
