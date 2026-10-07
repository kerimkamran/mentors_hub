import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Alert, Button, Card, Heading } from "@/components/ui";
import { importScopeOptions, listRuns, residencyState } from "@/domain/people/queries";
import { importSettings } from "@/domain/people/settings";
import { CANONICAL, columnHeader } from "@/domain/people/columns";
import { requireActor } from "@/lib/auth/http";
import { formatDateTime, LOCALES, t } from "@/lib/i18n";
import { can, NotFoundError } from "@/lib/permissions";
import { uploadImport } from "./actions";
import { errorText } from "./error-text";

export const dynamic = "force-dynamic";

const field = "min-h-11 rounded-md border border-neutral-400 bg-transparent px-2";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ e?: string; d?: string }> }) {
  const actor = await requireActor();
  const l = actor.locale;
  const sp = await searchParams;
  let runs, options;
  try {
    runs = await listRuns(actor);
    options = await importScopeOptions(actor);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const settings = await importSettings(actor.organisationId);
  const { signedOffAt } = await residencyState(actor.organisationId);
  const canRun = options.length > 0;
  const canSync = can(actor, "import.full_sync");
  const errorCode = sp.e && /^[a-z_]{1,40}$/.test(sp.e) ? sp.e : null;
  const columns = (sp.d ?? "").split(",").filter((x) => (CANONICAL as readonly string[]).includes(x)).map((c) => columnHeader(c as (typeof CANONICAL)[number], l)).join(", ");

  return (
    <Shell wide>
      <Heading>{t(l, "people.import.title")}</Heading>
      <p className="mt-2 max-w-3xl">{t(l, "people.import.intro")}</p>

      <div className="mt-4">
        <Alert kind={signedOffAt ? "success" : "error"}>
          {signedOffAt ? t(l, "people.import.residency.ok", { date: formatDateTime(signedOffAt, l, actor.timeZone) }) : t(l, "people.import.residency.missing")}
        </Alert>
      </div>

      {errorCode && (
        <div className="mt-4">
          <Alert kind="error">{errorText(l, errorCode, columns)}</Alert>
        </div>
      )}

      {canRun && (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">{t(l, "people.import.upload.title")}</h2>
          <form action={uploadImport} className="mt-3 flex max-w-2xl flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="file" className="font-medium">{t(l, "people.import.file")}</label>
              <input id="file" name="file" type="file" required accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-describedby="file-hint" className="min-h-11 py-2" />
              <p id="file-hint" className="text-sm opacity-80">{t(l, "people.import.file.hint", { mb: Math.round(settings.maxFileBytes / 1048576), rows: settings.maxRows })}</p>
            </div>
            {options.length > 1 || options[0]!.kind !== "org" ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="scope" className="font-medium">{t(l, "people.import.scope")}</label>
                <select id="scope" name="scope" className={field}>
                  {options.map((o) => <option key={o.value} value={o.value}>{o.kind === "org" ? t(l, "people.import.scope.org") : o.label}</option>)}
                </select>
              </div>
            ) : (
              <input type="hidden" name="scope" value="org" />
            )}
            <div className="flex items-start gap-3">
              <input id="synthetic" name="synthetic" type="checkbox" className="mt-1 h-5 w-5" aria-describedby="synthetic-hint" />
              <div>
                <label htmlFor="synthetic" className="font-medium">{t(l, "people.import.synthetic")}</label>
                <p id="synthetic-hint" className="text-sm opacity-80">{t(l, "people.import.synthetic.hint")}</p>
              </div>
            </div>
            {canSync && (
              <div className="flex items-start gap-3">
                <input id="full_sync" name="full_sync" type="checkbox" className="mt-1 h-5 w-5" aria-describedby="sync-hint" />
                <div>
                  <label htmlFor="full_sync" className="font-medium">{t(l, "people.import.full_sync")}</label>
                  <p id="sync-hint" className="text-sm opacity-80">{t(l, "people.import.full_sync.hint")}</p>
                </div>
              </div>
            )}
            <div><Button type="submit">{t(l, "people.import.preview")}</Button></div>
          </form>
          <div className="mt-6 border-t border-neutral-300 pt-4 dark:border-neutral-700">
            <h3 className="font-semibold">{t(l, "people.import.template.title")}</h3>
            <p className="mt-1 max-w-3xl text-sm">{t(l, "people.import.template.intro")}</p>
            <p className="mt-2 flex flex-wrap gap-4">
              <a className="underline" href={`/admin/import/template?format=csv&lang=${l}`}>{t(l, "people.import.template.csv")}</a>
              <a className="underline" href={`/admin/import/template?format=xlsx&lang=${l}`}>{t(l, "people.import.template.xlsx")}</a>
            </p>
            <p className="mt-1 text-sm opacity-80">{LOCALES.map((x) => t(x, `lang.${x}`)).join(" · ")}</p>
          </div>
        </Card>
      )}

      <h2 className="mt-8 text-lg font-semibold">{t(l, "people.import.history")}</h2>
      {runs.length === 0 ? (
        <p className="mt-2">{t(l, "people.import.history.empty")}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                {["date", "by", "scope", "mode", "state", "data", "created", "updated", "unchanged", "deactivated", "rejected"].map((c) => <th key={c} scope="col" className="py-2 pr-3">{t(l, `people.import.col.${c}`)}</th>)}
                <th scope="col" className="py-2"><span className="sr-only">{t(l, "people.import.open")}</span></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-neutral-300 align-top dark:border-neutral-700">
                  <td className="py-2 pr-3">{formatDateTime(r.createdAt, l, actor.timeZone)}</td>
                  <td className="pr-3">{r.startedByName}</td>
                  <td className="pr-3">{r.scopeName ?? t(l, "people.import.scope.whole")}</td>
                  <td className="pr-3">{t(l, `people.import.mode.${r.mode}`)}</td>
                  <td className="pr-3">{t(l, `people.import.state.${r.state}`)}</td>
                  <td className="pr-3">{t(l, r.isSynthetic ? "people.import.data.synthetic" : "people.import.data.real")}</td>
                  <td className="pr-3">{r.counts.created}</td>
                  <td className="pr-3">{r.counts.updated}</td>
                  <td className="pr-3">{r.counts.unchanged}</td>
                  <td className="pr-3">{r.counts.deactivated}</td>
                  <td className="pr-3">{r.counts.rejected}</td>
                  <td><Link className="inline-flex min-h-11 items-center underline" href={`/admin/import/${r.id}`}>{t(l, "people.import.open")}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
