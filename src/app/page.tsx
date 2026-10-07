import { Shell } from "@/components/Shell";
import { Heading } from "@/components/ui";
import { requireActor } from "@/lib/auth/http";
import { t } from "@/lib/i18n";
import { withOrg } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await requireActor();
  const profile = await withOrg(actor.organisationId, (tx) =>
    tx.query<{ display_name: string }>("SELECT display_name FROM person_profile WHERE membership_id = $1", [actor.membershipId]),
  );
  const name = profile.rows[0]?.display_name ?? "";
  return (
    <Shell>
      <Heading>{t(actor.locale, "home.title")}</Heading>
      <p className="mt-3">{t(actor.locale, "home.welcome", { name })}</p>
      <p className="mt-2 opacity-80">{t(actor.locale, "home.uptodate")}</p>
    </Shell>
  );
}
