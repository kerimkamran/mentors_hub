import { Shell } from "@/components/Shell";
import { Alert, Button, Field, Heading } from "@/components/ui";
import { getLocale } from "@/lib/auth/http";
import { peekInvite } from "@/lib/auth/invite";
import { t } from "@/lib/i18n";
import Link from "next/link";
import { acceptInvite } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS = new Set(["mismatch", "too_short", "too_long", "weak"]);

/**
 * Landing page of an invite link. A read-only GET: it renders the "choose a password" form and changes nothing, so a
 * link previewer or scanner that opens the link cannot use it up or sign anyone in (INV-5.1).
 */
export default async function Invite({ searchParams }: { searchParams: Promise<{ t?: string; e?: string }> }) {
  const { t: token, e } = await searchParams;
  const locale = await getLocale();
  const usable = token ? (await peekInvite(token)) === "usable" : false;
  return (
    <Shell>
      {usable && token ? (
        <>
          <Heading>{t(locale, "invite.title")}</Heading>
          <p className="mt-3">{t(locale, "invite.intro")}</p>
          {e && ERRORS.has(e) && <div className="mt-4"><Alert kind="error">{t(locale, `invite.error.${e}`)}</Alert></div>}
          <form action={acceptInvite} className="mt-6 flex flex-col gap-4">
            <input type="hidden" name="token" value={token} />
            <Field label={t(locale, "invite.password")} name="password" type="password" autoComplete="new-password" maxLength={128} />
            <Field label={t(locale, "invite.confirm")} name="confirm" type="password" autoComplete="new-password" maxLength={128} />
            <div><Button type="submit">{t(locale, "invite.continue")}</Button></div>
          </form>
        </>
      ) : (
        <>
          <Heading>{t(locale, "invite.invalid.title")}</Heading>
          <div className="mt-4"><Alert kind="error">{t(locale, "invite.invalid.body")}</Alert></div>
          <p className="mt-4"><Link href="/signin" className="underline">{t(locale, "invite.to_signin")}</Link></p>
        </>
      )}
    </Shell>
  );
}
