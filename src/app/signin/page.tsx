import { Shell } from "@/components/Shell";
import { Alert, Button, Field, Heading } from "@/components/ui";
import { getActor, getLocale } from "@/lib/auth/http";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { signIn } from "./actions";

export const dynamic = "force-dynamic";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await getActor()) redirect("/");
  const { e } = await searchParams;
  const locale = await getLocale();
  return (
    <Shell>
      <Heading>{t(locale, "signin.title")}</Heading>
      <p className="mt-3">{t(locale, "signin.intro")}</p>
      {e && <div className="mt-4"><Alert kind="error">{t(locale, e === "limited" ? "signin.too_many" : "signin.failed")}</Alert></div>}
      <form action={signIn} className="mt-6 flex flex-col gap-4">
        <Field label={t(locale, "signin.email")} name="email" type="email" autoComplete="username" inputMode="email" />
        <Field label={t(locale, "signin.password")} name="password" type="password" autoComplete="current-password" maxLength={1024} />
        <Button type="submit">{t(locale, "signin.submit")}</Button>
      </form>
      <p className="mt-4 text-sm opacity-80">{t(locale, "signin.forgot")}</p>
    </Shell>
  );
}
