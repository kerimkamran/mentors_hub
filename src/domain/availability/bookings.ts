import type { Tx } from "@/lib/db";
import type { Interval } from "./slots";

/**
 * Seam to the booking slice (S7): the sessions a person already has between two instants. S7 replaces the body
 * with a query of its session table; until then there are no bookings. Slot generation treats these as busy.
 */
export async function getBookedIntervals(_tx: Tx, _membershipId: string, _from: Date, _until: Date): Promise<Interval[]> {
  return [];
}
