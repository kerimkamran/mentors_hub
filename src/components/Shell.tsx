import Link from "next/link";
import type { ReactNode } from "react";
import { getActor, getLocale } from "@/lib/auth/http";
import { LOCALES, t } from "@/lib/i18n";
import { can, isOrgAdmin } from "@/lib/permissions";
import { setLanguage, signOut } from "@/app/shell-actions";

/** Page frame: header with navigation, language switcher and sign-out. */
export async function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const locale = await getLocale();
  const actor = await getActor();
  return (
    <>
      <header className="border-b border-neutral-300 dark:border-neutral-700">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold">{t(locale, "app.name")}</Link>
          <nav aria-label="Main" className="flex flex-wrap gap-4">
            {actor && <Link href="/">{t(locale, "nav.home")}</Link>}
            {actor && isOrgAdmin(actor) && <Link href="/admin/roles">{t(locale, "nav.admin")}</Link>}
            {actor && can(actor, "people.directory.view") && <Link href="/admin/people">{t(locale, "nav.people")}</Link>}
            {actor && can(actor, "import.list") && <Link href="/admin/import">{t(locale, "nav.import")}</Link>}
            {actor && <Link href="/settings">{t(locale, "settings.title")}</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <form action={setLanguage} className="flex items-center gap-2">
              <label htmlFor="lang" className="sr-only">{t(locale, "nav.language")}</label>
              <select id="lang" name="lang" defaultValue={locale} className="min-h-11 rounded-md border border-neutral-400 bg-transparent px-2">
                {LOCALES.map((l) => <option key={l} value={l}>{t(l, `lang.${l}`)}</option>)}
              </select>
              <button className="min-h-11 rounded-md border border-neutral-500 px-3" type="submit">OK</button>
            </form>
            {actor && (
              <form action={signOut}>
                <button className="min-h-11 rounded-md border border-neutral-500 px-3" type="submit">{t(locale, "nav.signout")}</button>
              </form>
            )}
          </div>
        </div>
      </header>
      <main id="main" className={`mx-auto px-4 py-8 ${wide ? "max-w-5xl" : "max-w-xl"}`}>{children}</main>
    </>
  );
}
