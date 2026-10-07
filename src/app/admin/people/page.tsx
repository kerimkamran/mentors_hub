import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Button, Heading } from "@/components/ui";
import { MEMBERSHIP_STATUSES, parseFilters, PARTICIPATION_STATUSES, searchDirectory } from "@/domain/people/directory";
import { requireActor } from "@/lib/auth/http";
import { t } from "@/lib/i18n";
import { NotFoundError } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const field = "min-h-11 rounded-md border border-neutral-400 bg-transparent px-2";

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const l = actor.locale;
  const sp = await searchParams;
  const one = (n: string) => (Array.isArray(sp[n]) ? sp[n]![0] : sp[n]);
  const filters = parseFilters(one);
  const pageNo = Math.max(1, Number.parseInt(one("page") ?? "1", 10) || 1);
  let data;
  try {
    data = await searchDirectory(actor, filters, pageNo);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const query = (page: number) => {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.department) p.set("department", filters.department);
    if (filters.programmeId) p.set("programme", filters.programmeId);
    if (filters.participation) p.set("participation", filters.participation);
    if (filters.status) p.set("status", filters.status);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/admin/people${s ? `?${s}` : ""}`;
  };

  return (
    <Shell wide>
      <Heading>{t(l, "people.directory.title")}</Heading>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3" role="search">
        <div className="flex min-w-60 flex-1 flex-col gap-1">
          <label htmlFor="q" className="font-medium">{t(l, data.canSeeHr ? "people.directory.search.hr" : "people.directory.search")}</label>
          <input id="q" name="q" type="search" defaultValue={filters.q ?? ""} maxLength={100} className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="department" className="font-medium">{t(l, "people.directory.department")}</label>
          <select id="department" name="department" defaultValue={filters.department ?? ""} className={field}>
            <option value="">{t(l, "people.directory.all")}</option>
            {data.departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="programme" className="font-medium">{t(l, "people.directory.programme")}</label>
          <select id="programme" name="programme" defaultValue={filters.programmeId ?? ""} className={field}>
            <option value="">{t(l, "people.directory.all")}</option>
            {data.programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="participation" className="font-medium">{t(l, "people.directory.participation")}</label>
          <select id="participation" name="participation" defaultValue={filters.participation ?? ""} className={field}>
            <option value="">{t(l, "people.directory.all")}</option>
            {PARTICIPATION_STATUSES.map((s) => <option key={s} value={s}>{t(l, `people.participation.${s}`)}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="font-medium">{t(l, "people.directory.status")}</label>
          <select id="status" name="status" defaultValue={filters.status ?? ""} className={field}>
            <option value="">{t(l, "people.directory.all")}</option>
            {MEMBERSHIP_STATUSES.map((s) => <option key={s} value={s}>{t(l, `people.status.${s}`)}</option>)}
          </select>
        </div>
        <Button type="submit">{t(l, "people.directory.apply")}</Button>
        <Link href="/admin/people" className="inline-flex min-h-11 items-center underline">{t(l, "people.directory.clear")}</Link>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <p role="status">{t(l, "people.directory.count", { n: data.total })}</p>
        {data.canExport && (
          <form action="/admin/people/export" method="post">
            {filters.q && <input type="hidden" name="q" value={filters.q} />}
            {filters.department && <input type="hidden" name="department" value={filters.department} />}
            {filters.programmeId && <input type="hidden" name="programme" value={filters.programmeId} />}
            {filters.participation && <input type="hidden" name="participation" value={filters.participation} />}
            {filters.status && <input type="hidden" name="status" value={filters.status} />}
            <Button type="submit" variant="secondary">{t(l, "people.directory.export")}</Button>
          </form>
        )}
      </div>
      {data.canExport && !data.canSeeHr && <p className="mt-1 text-sm opacity-80">{t(l, "people.directory.export.basic")}</p>}

      {data.rows.length === 0 ? (
        <p className="mt-6">{t(l, "people.directory.empty")}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-3">{t(l, "people.directory.col.name")}</th>
                <th scope="col" className="pr-3">{t(l, "people.directory.col.department")}</th>
                <th scope="col" className="pr-3">{t(l, "people.directory.col.title")}</th>
                <th scope="col" className="pr-3">{t(l, "people.directory.col.participation")}</th>
                <th scope="col" className="pr-3">{t(l, "people.directory.col.status")}</th>
                {data.canSeeHr && <th scope="col" className="pr-3">{t(l, "people.directory.col.grade")}</th>}
                {data.canSeeHr && <th scope="col">{t(l, "people.directory.col.manager")}</th>}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.membershipId} className="border-t border-neutral-300 align-top dark:border-neutral-700">
                  <th scope="row" className="py-2 pr-3 font-normal"><Link className="inline-flex min-h-11 items-center underline" href={`/admin/people/${r.membershipId}`}>{r.displayName}</Link></th>
                  <td className="pr-3">{r.department}</td>
                  <td className="pr-3">{r.jobTitle}</td>
                  <td className="pr-3">
                    {r.participations.length === 0 ? t(l, "people.directory.no_participation") : (
                      <ul>{r.participations.map((p, i) => <li key={i}>{p.programmeName} / {p.cohortName}: {t(l, `people.kind.${p.kind}`)} ({t(l, `people.participation.${p.status}`)})</li>)}</ul>
                    )}
                  </td>
                  <td className="pr-3">{t(l, `people.status.${r.status}`)}</td>
                  {data.canSeeHr && <td className="pr-3">{r.gradeBucket ?? "–"}</td>}
                  {data.canSeeHr && <td>{r.managerName ?? "–"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={t(l, "people.directory.page", { page: data.page, pages })} className="mt-4 flex items-center gap-4">
          {data.page > 1 ? <Link className="inline-flex min-h-11 items-center underline" href={query(data.page - 1)}>{t(l, "people.directory.prev")}</Link> : null}
          <span>{t(l, "people.directory.page", { page: data.page, pages })}</span>
          {data.page < pages ? <Link className="inline-flex min-h-11 items-center underline" href={query(data.page + 1)}>{t(l, "people.directory.next")}</Link> : null}
        </nav>
      )}
    </Shell>
  );
}
