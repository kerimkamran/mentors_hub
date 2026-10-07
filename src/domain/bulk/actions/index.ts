/**
 * Bulk action registry: one file per action (invite, nominate, withdraw, send reminder, erase …), ONE line each here,
 * grouped by owning slice with blank lines between groups. Each action's evaluate() must authorize() per row.
 */
import type { BulkAction } from "../types";

export const ACTIONS: BulkAction[] = [
  // S2 people directory (invite, nominate, withdraw, send reminder)

  // S3 programmes

  // S6 matching

  // S13 data rights (bulk erasure: fourEyes)
];
