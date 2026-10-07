import type { Tx } from "@/lib/db";
import { can, type Actor } from "@/lib/permissions";

/**
 * Command palette registry (FR-ADM-019, SCR-34). Each slice adds its items here: static PAGES/ACTIONS (a link plus
 * the permission that shows it) and searchable SOURCES (programmes, people …). The palette only ever OPENS a screen:
 * an item is a link, never a command (AC-ADM-14.4). Results are trimmed to what the actor may use (AC-ADM-14.3).
 * Add a line in your own group; blank lines separate the groups so slices do not collide.
 */
export type PaletteGroup = "pages" | "programmes" | "people" | "actions";

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  href: string;
  hint?: string;
}

export interface StaticItem {
  id: string;
  group: "pages" | "actions";
  /** Message key in src/messages (resolved in the actor's language). */
  labelKey: string;
  href: string;
  /** Extra words that find it ("jobs", "queue" …); matched with the same folding as names. */
  keywords?: string[];
  allowed: (actor: Actor) => boolean;
}

export interface SearchSource {
  id: string;
  group: "programmes" | "people";
  allowed: (actor: Actor) => boolean;
  /** `q` is already normalised (src/lib/search.ts); return at most `limit` items the actor may open. */
  search: (tx: Tx, actor: Actor, q: string, limit: number) => Promise<PaletteItem[]>;
}

export const STATIC_ITEMS: StaticItem[] = [
  // S1 · access
  { id: "page.roles", group: "pages", labelKey: "nav.roles", href: "/admin/roles", keywords: ["permissions", "access"], allowed: (a) => can(a, "role.list") },

  // S3 · notifications and operations
  { id: "page.ops.jobs", group: "pages", labelKey: "nav.ops.jobs", href: "/admin/ops/jobs", keywords: ["queue", "background", "retry"], allowed: (a) => can(a, "ops.jobs.view") || can(a, "ops.jobs.platform_health") },
  { id: "page.ops.email", group: "pages", labelKey: "nav.ops.email", href: "/admin/ops/email", keywords: ["delivery", "bounce", "mail"], allowed: (a) => can(a, "ops.email.view") },
  { id: "page.emails", group: "pages", labelKey: "nav.emails", href: "/admin/emails", keywords: ["templates", "preview", "notifications"], allowed: (a) => can(a, "email.template.preview") },
  { id: "page.announcements", group: "pages", labelKey: "nav.announcements", href: "/admin/announcements", keywords: ["banner", "message"], allowed: (a) => can(a, "announcement.list") },
  { id: "page.appearance", group: "pages", labelKey: "nav.appearance", href: "/settings/appearance", keywords: ["theme", "dark", "dense"], allowed: (a) => can(a, "palette.use") },
  { id: "action.announcement.new", group: "actions", labelKey: "palette.action.announcement", href: "/admin/announcements#new", keywords: ["post", "banner"], allowed: (a) => can(a, "announcement.list") },

  // S2 · people (invite person …)

  // S5 · vetting

  // S6 · matching
];

export const SOURCES: SearchSource[] = [];

/** Registered by sources/*.ts; kept in a list so tests can swap sources. */
export function registerSource(s: SearchSource): void {
  const i = SOURCES.findIndex((x) => x.id === s.id);
  if (i >= 0) SOURCES[i] = s;
  else SOURCES.push(s);
}
