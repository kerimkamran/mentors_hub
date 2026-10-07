import { VISIBILITY_LEVELS, type VisibilityField, type VisibilityLevel } from "@/domain/profiles/constants";
import { levelAllowed } from "@/domain/profiles/visibility";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/constants";
import { changeVisibility } from "./actions";

export type KindsKey = "mentor" | "mentee" | "both";

export function levelLabel(l: Locale, level: VisibilityLevel, kinds: KindsKey): string {
  return level === "only_me" ? t(l, "vis.level.only_me") : level === "request_or_match" ? t(l, "vis.level.request_or_match") : t(l, `vis.level.counterparts.${kinds}`);
}

/** One select next to a field (SCR-03): changing it saves immediately for new reads. Works without JavaScript. */
export function VisibilityControl({ field, level, locale, kinds }: { field: VisibilityField; level: VisibilityLevel; locale: Locale; kinds: KindsKey }) {
  const id = `vis-${field}`;
  const fieldName = t(locale, `prf.field.${field}`);
  return (
    <form action={changeVisibility} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="field" value={field} />
      <label htmlFor={id} className="text-sm">{t(locale, "prf.visibility.label", { field: fieldName })}</label>
      <select id={id} name="level" defaultValue={level} className="min-h-11 rounded-md border border-neutral-400 bg-transparent px-2">
        {VISIBILITY_LEVELS.filter((x) => levelAllowed(field, x)).map((x) => <option key={x} value={x}>{levelLabel(locale, x, kinds)}</option>)}
      </select>
      <button type="submit" className="min-h-11 min-w-11 rounded-md border border-neutral-500 px-3 text-sm">{t(locale, "prf.visibility.apply")}</button>
    </form>
  );
}
