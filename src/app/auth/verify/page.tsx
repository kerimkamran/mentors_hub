import { Shell } from "@/components/Shell";
import { Alert, Button, Heading } from "@/components/ui";
import { getLocale, readBrowserId } from "@/lib/auth/http";
import { peekLink } from "@/lib/auth/core";
import { t } from "@/lib/i18n";
import Link from "next/link";
import { continueWithLink } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Landing page of the emailed link. It is a read-only GET: it renders a button and changes nothing,
 * so a mail scanner that opens the link cannot sign anyone in (INV-5.1, INV-5.2).
 */
export default async function Verify({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t: token } = await searchParams;
  const locale = await getLocale();
  const usable = token ? (await peekLink(token, await readBrowserId())) === "usable" : false;
  return (
    <Shell>
      {usable && token ? (
        <>
          <Heading>{t(locale, "verify.title")}</Heading>
          <p className="mt-3">{t(locale, "verify.intro")}</p>
          <form action={continueWithLink} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <Button type="submit">{t(locale, "verify.continue")}</Button>
          </form>
        </>
      ) : (
        <>
          <Heading>{t(locale, "verify.invalid.title")}</Heading>
          <div className="mt-4"><Alert kind="error">{t(locale, "verify.invalid.body")}</Alert></div>
          <p className="mt-4"><Link href="/signin" className="underline">{t(locale, "signin.new_link")}</Link></p>
        </>
      )}
    </Shell>
  );
}
