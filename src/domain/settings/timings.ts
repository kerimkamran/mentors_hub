/** Pure helpers consumers use with the `timings` group (AC-PRG-03.3, AC-PRG-03.4). */

/** When a reminder lead time fires, computed ONCE at scheduling time: later settings changes never move it (AC-PRG-03.3). */
export const reminderAt = (eventAt: Date, leadDays: number): Date => new Date(eventAt.getTime() - leadDays * 86_400_000);

/**
 * Re-application cool-off (C-151, AC-PRG-03.4): the first instant a rejected or withdrawn applicant may apply again.
 * 0 days means immediately (returns the decision time itself). The date is shown to the applicant neutrally.
 */
export const coolOffEndsAt = (decidedAt: Date, coolOffDays: number): Date => new Date(decidedAt.getTime() + coolOffDays * 86_400_000);
export const mayReapply = (decidedAt: Date, coolOffDays: number, now: Date): boolean => now.getTime() >= coolOffEndsAt(decidedAt, coolOffDays).getTime();
