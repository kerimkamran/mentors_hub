import { Shell } from "@/components/Shell";
import { Alert, Button, Field, Heading } from "@/components/ui";
import { getLocale } from "@/lib/auth/http";
import { t } from "@/lib/i18n";
import Link from "next/link";
import { submitCode } from "../actions";

export const dynamic = "force-dynamic";

export default async function Sent({ searchParams }: { searchParams: Promise<{ bad?: string; limited?: string }> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  return (
    <Shell>
      <Heading>{t(locale, "signin.sent.title")}</Heading>
      <div className="mt-4 flex flex-col gap-4">
        {sp.limited ? <Alert kind="error">{t(locale, "signin.too_many")}</Alert> : <Alert>{t(locale, "signin.sent.neutral")}</Alert>}
        {sp.bad && <Alert kind="error">{t(locale, "signin.code.invalid")}</Alert>}
        <p>{t(locale, "signin.sent.hint")}</p>
        <form action={submitCode} className="flex flex-col gap-4">
          <Field label={t(locale, "signin.code")} name="code" inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7} autoComplete="one-time-code" />
          <Button type="submit">{t(locale, "signin.code.submit")}</Button>
        </form>
        <Link href="/signin" className="underline">{t(locale, "signin.new_link")}</Link>
      </div>
    </Shell>
  );
}
