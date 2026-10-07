import { Shell } from "@/components/Shell";
import { Button, Heading } from "@/components/ui";
import { loadAppearance } from "@/domain/appearance";
import { requireActor } from "@/lib/auth/http";
import { t } from "@/lib/i18n";
import { DENSITIES, THEMES } from "@/lib/theme-tokens";
import { saveAppearanceForm } from "./actions";

export const dynamic = "force-dynamic";

/** SCR-19/28 appearance: light, dark or follow the device; comfortable or dense tables. Saved per person (AC-ADM-23.5). */
export default async function AppearancePage() {
  const actor = await requireActor();
  const a = await loadAppearance(actor.identityId);
  const l = actor.locale;
  return (
    <Shell>
      <Heading>{t(l, "appearance.title")}</Heading>
      <form action={saveAppearanceForm} className="mt-6 flex flex-col gap-6">
        <fieldset className="flex flex-col gap-1">
          <legend className="font-medium">{t(l, "appearance.theme")}</legend>
          {THEMES.map((v) => (
            <label key={v} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="theme" value={v} defaultChecked={a.theme === v} /> {t(l, `appearance.theme.${v}`)}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="font-medium">{t(l, "appearance.density")}</legend>
          {DENSITIES.map((v) => (
            <label key={v} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="density" value={v} defaultChecked={a.density === v} /> {t(l, `appearance.density.${v}`)}
            </label>
          ))}
        </fieldset>
        <div><Button type="submit">{t(l, "common.save")}</Button></div>
      </form>
    </Shell>
  );
}
