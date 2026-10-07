import { Shell } from "@/components/Shell";
import { Heading } from "@/components/ui";
import { getLocale } from "@/lib/auth/http";
import { t } from "@/lib/i18n";

/** The one response for a missing page AND a denied one (INV-4.3). */
export default async function NotFound() {
  const locale = await getLocale();
  return (
    <Shell>
      <Heading>{t(locale, "error.notfound.title")}</Heading>
      <p className="mt-3">{t(locale, "error.notfound.body")}</p>
    </Shell>
  );
}
