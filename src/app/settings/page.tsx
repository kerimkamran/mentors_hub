import { Shell } from "@/components/Shell";
import { Button, Field, Heading } from "@/components/ui";
import { requireActor } from "@/lib/auth/http";
import { LOCALES, t } from "@/lib/i18n";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const actor = await requireActor();
  const l = actor.locale;
  return (
    <Shell>
      <Heading>{t(l, "settings.title")}</Heading>
      <form action={saveSettings} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="locale" className="font-medium">{t(l, "settings.language")}</label>
          <select id="locale" name="locale" defaultValue={l} className="min-h-11 rounded-md border border-neutral-400 bg-transparent px-2">
            {LOCALES.map((x) => <option key={x} value={x}>{t(x, `lang.${x}`)}</option>)}
          </select>
        </div>
        <Field label={t(l, "settings.timezone")} name="time_zone" defaultValue={actor.timeZone} hint="Asia/Baku" />
        <Button type="submit">{t(l, "settings.save")}</Button>
      </form>
    </Shell>
  );
}
