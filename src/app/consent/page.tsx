import { Shell } from "@/components/Shell";
import { Button, Card, Heading } from "@/components/ui";
import { requireActor } from "@/lib/auth/http";
import { hasAcceptedNotice } from "@/lib/auth/core";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { accept, decline } from "./actions";

export const dynamic = "force-dynamic";

export default async function Consent() {
  const actor = await requireActor({ consent: false });
  if (await hasAcceptedNotice(actor)) redirect("/");
  const l = actor.locale;
  return (
    <Shell>
      <Heading>{t(l, "consent.title")}</Heading>
      <Card className="mt-4"><p>{t(l, "consent.body")}</p></Card>
      <form action={accept} className="mt-6 flex flex-col gap-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="ai" className="mt-1 size-5" />
          <span>{t(l, "consent.ai.label")}</span>
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">{t(l, "consent.accept")}</Button>
          <Button type="submit" variant="secondary" formAction={decline}>{t(l, "consent.decline")}</Button>
        </div>
      </form>
    </Shell>
  );
}
