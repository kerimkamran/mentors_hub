/**
 * Template registry: ONE line per template, grouped by slice with blank lines between groups so parallel slices
 * add lines without touching each other's (merge-friendly). Convention in docs/NOTIFICATIONS.md.
 */
import type { TemplateDef } from "../types";

// ---- S1 · sign-in and access
import { template as n001 } from "./n-001";
import { template as n002 } from "./n-002";
import { template as n003 } from "./n-003";

// ---- S2 · people and import
import { template as n010 } from "./n-010";

// ---- S3 · programme administration, announcements
import { template as n011 } from "./n-011";
import { template as n012 } from "./n-012";
import { template as n086 } from "./n-086";

// ---- S4/S5 · profiles, vetting (N-020 … N-025)


// ---- S6 · matching and relationships (N-030 … N-043)


// ---- S7/S8 · scheduling, sessions, goals, check-ins (N-050 … N-063)


// ---- S9 · reports, safeguarding, privacy, system (N-070 … N-085)


export const ALL_TEMPLATES: TemplateDef[] = [
  // S1
  n001, n002, n003,

  // S2
  n010,

  // S3
  n011, n012, n086,

  // S4/S5


  // S6


  // S7/S8


  // S9
];
