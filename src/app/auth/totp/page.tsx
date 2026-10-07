import { Shell } from "@/components/Shell";
import { Alert, Button, Field, Heading } from "@/components/ui";
import { requireActor } from "@/lib/auth/http";
import { beginTotpEnrol, totpRequired } from "@/lib/auth/core";
import { withGlobal } from "@/lib/db";
import { t } from "@/lib/i18n";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { verifyAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Totp({ searchParams }: { searchParams: Promise<{ bad?: string }> }) {
  const actor = await requireActor({ consent: false, totp: false });
  if (!totpRequired(actor) || actor.totpVerified) redirect("/");
  const sp = await searchParams;
  const l = actor.locale;
  let enrol: { secret: string; uri: string; svg: string } | null = null;
  if (!actor.totpEnrolled) {
    const email = (await withGlobal((tx) => tx.query<{ email: string }>("SELECT email FROM identity WHERE id = $1", [actor.identityId]))).rows[0]!.email;
    const e = await beginTotpEnrol(actor, email);
    if (e) enrol = { ...e, svg: await QRCode.toString(e.uri, { type: "svg", margin: 1 }) };
  }
  return (
    <Shell>
      <Heading>{t(l, enrol ? "totp.enrol.title" : "totp.verify.title")}</Heading>
      {enrol && (
        <div className="mt-4 flex flex-col gap-3">
          <p>{t(l, "totp.enrol.intro")}</p>
          <div className="w-48 bg-white p-2" role="img" aria-label="QR code" dangerouslySetInnerHTML={{ __html: enrol.svg }} />
          <p><span className="font-medium">{t(l, "totp.enrol.key")}:</span> <code>{enrol.secret}</code></p>
        </div>
      )}
      {sp.bad && <div className="mt-4"><Alert kind="error">{t(l, "totp.invalid")}</Alert></div>}
      <form action={verifyAction} className="mt-6 flex flex-col gap-4">
        <Field label={t(l, "totp.code")} name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" />
        <Button type="submit">{t(l, "totp.submit")}</Button>
      </form>
    </Shell>
  );
}
