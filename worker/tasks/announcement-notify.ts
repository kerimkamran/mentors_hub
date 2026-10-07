import type { Task } from "graphile-worker";
import { notifyAnnouncement } from "../../src/domain/announcements/commands";

/** announcement.notify {organisationId, announcementId}: the optional "also notify" email (link only), sent when the announcement starts. */
export const announcementNotify: Task = async (payload, helpers) => {
  const p = payload as { organisationId: string; announcementId: string };
  const n = await notifyAnnouncement(p.organisationId, p.announcementId);
  helpers.logger.info(`announcement.notify ${n}`);
};
