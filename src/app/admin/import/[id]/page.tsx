import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Alert, Button, Card, Heading } from "@/components/ui";
import { getRun, type RunRow } from "@/domain/people/queries";
import { RAW_IMPORT_ROW_RETENTION_DAYS } from "@/domain/people/constants";
import { requireActor } from "@/lib/auth/http";
import { formatDateTime, t, type Locale } from "@/lib/i18n";
import { can, NotFoundError } from "@/lib/permissions";
import { confirmRun } from "../actions";
import { errorText } from "../error-text";

export const dynamic = "force-dynamic";

export default async function ImportRunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; stale?: string }> }) {
  const actor = await requireActor();
  const l = actor.locale;
  const { id } = await params;
  const sp = await searchParams;
  let d;
  try {
    d = await getRun(actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { run, rejected, samples } = d;
  const canConfirm = run.state === "previewed" && !run.rowsPurged && can(actor, "import.run", { programmeId: run.scopeProgrammeId ?? undefined, cohortId: run.scopeCohortId ?? undefined });
  const blockedResidency = run.state === "previewed" && !run.isSynthetic && !d.signedOffAt;
  const errorCode = sp.e && /^[a-z_]{1,40}$/.test(sp.e) ? sp.e : null;
  const stats: [string, number][] = [
    ["created", run.counts.created], ["updated", run.counts.updated], ["unchanged", run.counts.unchanged],
    ["deactivated", run.counts.deactivated], ["rejected", run.counts.rejected],
  ];

  return (
    <Shell wide>
      <p><Link href="/admin/import" className="inline-flex min-h-11 items-center underline">{t(l, "people.run.back")}</Link></p>
      <Heading>{t(l, "people.run.title", { date: formatDateTime(run.createdAt, l, actor.timeZone) })}</Heading>

      <div className="mt-4 flex flex-col gap-3">
        <Alert kind={run.state === "applied" ? "success" : "info"}>
          {run.state === "applied" && run.confirmedAt
            ? t(l, "people.run.applied.banner", { date: formatDateTime(run.confirmedAt, l, actor.timeZone) })
            : t(l, "people.run.preview.banner")}
        </Alert>
        {sp.stale && <Alert kind="error">{t(l, "people.run.stale")}</Alert>}
        {errorCode && <Alert kind="error">{errorText(l, errorCode)}</Alert>}
        {blockedResidency && <Alert kind="error">{t(l, "people.run.blocked.residency")}</Alert>}
        {d.blockedEmptyFullSync && <Alert kind="error">{t(l, "people.run.blocked.empty_full_sync")}</Alert>}
        {run.rowsPurged && <Alert kind="info">{t(l, "people.run.purged", { days: RAW_IMPORT_ROW_RETENTION_DAYS })}</Alert>}
      </div>

      <dl className="mt-4 grid max-w-3xl grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
        <dt className="font-medium">{t(l, "people.run.meta.by")}</dt><dd>{run.startedByName}</dd>
        <dt className="font-medium">{t(l, "people.run.meta.for")}</dt><dd>{run.scopeName ?? t(l, "people.import.scope.whole")}</dd>
        <dt className="font-medium">{t(l, "people.import.col.mode")}</dt><dd>{t(l, `people.import.mode.${run.mode}`)}</dd>
        <dt className="font-medium">{t(l, "people.import.col.data")}</dt><dd>{t(l, run.isSynthetic ? "people.import.data.synthetic" : "people.import.data.real")}</dd>
        <dt className="font-medium">{t(l, "people.run.meta.format")}</dt><dd>{run.format.toUpperCase()}</dd>
        <dt className="font-medium">{t(l, "people.run.meta.total")}</dt><dd>{run.counts.total}</dd>
      </dl>

      <h2 className="mt-6 text-lg font-semibold">{t(l, "people.run.counts")}</h2>
      <ul className="mt-2 flex flex-wrap gap-3">
        {stats.map(([k, n]) => (
          <li key={k}><Card className="min-w-32"><p className="text-sm">{t(l, `people.run.count.${k}`)}</p><p className="text-2xl font-semibold">{n}</p></Card></li>
        ))}
      </ul>
      <ul className="mt-3 list-disc pl-5">
        {run.fullSync && <li>{t(l, "people.run.full_sync.on")}</li>}
        {(run.counts.ladderAdded > 0 || run.counts.ladderChanged > 0) && <li>{t(l, "people.run.ladder", { added: run.counts.ladderAdded, changed: run.counts.ladderChanged })}</li>}
        {run.counts.flaggedRelationships > 0 && <li>{t(l, "people.run.flagged", { n: run.counts.flaggedRelationships })}</li>}
        {run.counts.keptAdmins > 0 && <li>{t(l, "people.run.kept_admins", { n: run.counts.keptAdmins })}</li>}
        {run.ignoredColumns > 0 && <li>{t(l, "people.run.ignored_columns", { n: run.ignoredColumns })}</li>}
      </ul>

      {canConfirm && (
        <form action={confirmRun} className="mt-4 flex flex-col items-start gap-2">
          <input type="hidden" name="id" value={run.id} />
          <p className="max-w-3xl text-sm">{t(l, "people.run.confirm.hint")}</p>
          <Button type="submit" disabled={blockedResidency || d.blockedEmptyFullSync}>{t(l, "people.run.confirm")}</Button>
        </form>
      )}

      {!run.rowsPurged && (
        <>
          <h2 className="mt-8 text-lg font-semibold">{t(l, "people.run.errors.title")}</h2>
          {run.counts.rejected === 0 ? (
            <p className="mt-2">{t(l, "people.run.errors.none")}</p>
          ) : (
            <>
              <form action={`/admin/import/${run.id}/error-file`} method="post" className="mt-2">
                <Button type="submit" variant="secondary">{t(l, "people.run.errors.download")}</Button>
              </form>
              <RowTable l={l} rows={rejected} showReason />
              {run.counts.rejected > rejected.length && <p className="mt-2 text-sm">{t(l, "people.run.errors.limit", { n: rejected.length })}</p>}
            </>
          )}
          {(["create", "update", "deactivate"] as const).map((k) =>
            samples[k].length > 0 ? (
              <section key={k} className="mt-8">
                <h2 className="text-lg font-semibold">{t(l, `people.run.sample.${k}`, { n: samples[k].length })}</h2>
                <RowTable l={l} rows={samples[k]} />
              </section>
            ) : null,
          )}
        </>
      )}
    </Shell>
  );
}

function RowTable({ l, rows, showReason = false }: { l: Locale; rows: RunRow[]; showReason?: boolean }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr>
            <th scope="col" className="py-2 pr-3">{t(l, "people.run.col.row")}</th>
            <th scope="col" className="pr-3">{t(l, "people.run.col.employee")}</th>
            <th scope="col" className="pr-3">{t(l, "people.run.col.name")}</th>
            {showReason && <th scope="col">{t(l, "people.run.col.reason")}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.rowNumber}-${i}`} className="border-t border-neutral-300 align-top dark:border-neutral-700">
              <td className="py-2 pr-3">{r.rowNumber ?? "–"}</td>
              <td className="pr-3">{r.raw.employee_id ?? ""}</td>
              <td className="pr-3">{r.raw.display_name ?? ""}</td>
              {showReason && <td>{r.reasonCode ? t(l, `people.import.reason.${r.reasonCode}`) : ""}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
