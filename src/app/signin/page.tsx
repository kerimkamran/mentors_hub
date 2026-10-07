import { Shell } from "@/components/Shell";
import { Button, Field, Heading } from "@/components/ui";
import { getActor, getLocale } from "@/lib/auth/http";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { requestLink } from "./actions";

export const dynamic = "force-dynamic";

export default async function SignIn() {
  if (await getActor()) redirect("/");
  const locale = await getLocale();
  return (
    <Shell>
      <Heading>{t(locale, "signin.title")}</Heading>
      <p className="mt-3">{t(locale, "signin.intro")}</p>
      <form action={requestLink} className="mt-6 flex flex-col gap-4">
        <Field label={t(locale, "signin.email")} name="email" type="email" autoComplete="email" inputMode="email" />
        <Button type="submit">{t(locale, "signin.submit")}</Button>
      </form>
    </Shell>
  );
}
