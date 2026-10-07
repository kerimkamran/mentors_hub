import { withOrg } from "@/lib/db";
import { t, type Locale } from "@/lib/i18n";
import { authorize, type Actor } from "@/lib/permissions";
import { normalise } from "@/lib/search";
import { SOURCES, STATIC_ITEMS, registerSource, type PaletteGroup, type PaletteItem } from "./registry";
import { peopleSource, programmesSource } from "./sources/directory";

registerSource(programmesSource);
registerSource(peopleSource);

export const PALETTE_LIMIT_PER_GROUP = 6;
export const GROUP_ORDER: PaletteGroup[] = ["pages", "programmes", "people", "actions"];

/**
 * Palette results for a query: pages and actions from the registry, programmes and people from the searchable sources,
 * each trimmed to what THIS actor may open (AC-ADM-14.3). Folding follows C-115 ("mammadov" finds Məmmədov). An empty
 * query lists the pages. A person who may not use the palette gets "not found" (AC-ADM-14.6).
 */
export async function searchPalette(actor: Actor, rawQuery: string, locale: Locale = actor.locale): Promise<PaletteItem[]> {
  authorize(actor, "palette.use");
  const q = normalise(rawQuery.trim().slice(0, 100));
  const out: PaletteItem[] = [];
  for (const s of STATIC_ITEMS) {
    if (!s.allowed(actor)) continue;
    const label = t(locale, s.labelKey);
    const hay = normalise([label, ...(s.keywords ?? [])].join(" "));
    if (q === "" || q.split(/\s+/).every((tok) => hay.includes(tok))) out.push({ id: s.id, group: s.group, label, href: s.href });
  }
  if (q.length >= 1) {
    await withOrg(actor.organisationId, async (tx) => {
      for (const src of SOURCES) {
        if (!src.allowed(actor)) continue;
        out.push(...(await src.search(tx, actor, q, PALETTE_LIMIT_PER_GROUP)));
      }
    });
  }
  return GROUP_ORDER.flatMap((g) => out.filter((i) => i.group === g).slice(0, PALETTE_LIMIT_PER_GROUP));
}
