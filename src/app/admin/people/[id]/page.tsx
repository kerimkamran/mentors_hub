import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Button, Card, Heading } from "@/components/ui";
import { getPerson } from "@/domain/people/directory";
import { requireActor } from "@/lib/auth/http";
import { formatDate, t } from "@/lib/i18n";
import { NotFoundError } from "@/lib/permissions";
import { deactivate } from "../actions";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const l = actor.locale;
  let p;
  try {
    p = await getPerson(actor, (await params).id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const hr = p.email !== undefined;
  return (
    <Shell wide>
      <p><Link href="/admin/people" className="inline-flex min-h-11 items-center underline">{t(l, "people.person.back")}</Link></p>
      <Heading>{p.displayName}</Heading>

      <Card className="mt-4 max-w-3xl">
        <h2 className="text-lg font-semibold">{t(l, "people.person.basics")}</h2>
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
          <dt className="font-medium">{t(l, "people.directory.col.department")}</dt><dd>{p.department ?? t(l, "people.person.none")}</dd>
          <dt className="font-medium">{t(l, "people.directory.col.title")}</dt><dd>{p.jobTitle ?? t(l, "people.person.none")}</dd>
          <dt className="font-medium">{t(l, "people.directory.col.status")}</dt><dd>{t(l, `people.status.${p.status}`)}</dd>
        </dl>
      </Card>

      <Card className="mt-4 max-w-3xl">
        <h2 className="text-lg font-semibold">{t(l, "people.person.participations")}</h2>
        {p.participations.length === 0 ? <p className="mt-2">{t(l, "people.directory.no_participation")}</p> : (
          <ul className="mt-2 list-disc pl-5">
            {p.participations.map((x, i) => <li key={i}>{x.programmeName} / {x.cohortName}: {t(l, `people.kind.${x.kind}`)} ({t(l, `people.participation.${x.status}`)})</li>)}
          </ul>
        )}
      </Card>

      {hr && (
        <Card className="mt-4 max-w-3xl">
          <h2 className="text-lg font-semibold">{t(l, "people.person.hr")}</h2>
          <p className="text-sm opacity-80">{t(l, "people.person.hr.note")}</p>
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
            <dt className="font-medium">{t(l, "people.person.email")}</dt><dd>{p.email}</dd>
            <dt className="font-medium">{t(l, "people.person.employee_id")}</dt><dd>{p.employeeId ?? t(l, "people.person.none")}</dd>
            <dt className="font-medium">{t(l, "people.person.hire_date")}</dt><dd>{p.hireDate ? formatDate(new Date(`${p.hireDate}T12:00:00Z`), l, "UTC") : t(l, "people.person.none")}</dd>
            <dt className="font-medium">{t(l, "people.person.grade")}</dt><dd>{p.gradeBucket ?? t(l, "people.person.none")}</dd>
            <dt className="font-medium">{t(l, "people.person.manager")}</dt><dd>{p.managerName ?? t(l, "people.person.none")}</dd>
            <dt className="font-medium">{t(l, "people.person.reports")}</dt><dd>{p.directReports ?? 0}</dd>
          </dl>
        </Card>
      )}

      {p.canDeactivate && (
        <form action={deactivate} className="mt-6 max-w-3xl">
          <input type="hidden" name="id" value={p.membershipId} />
          <p className="mb-2 text-sm">{t(l, "people.person.deactivate.hint")}</p>
          <div className="mb-2 flex items-center gap-3">
            <input id="confirm" name="confirm" type="checkbox" required className="h-5 w-5" />
            <label htmlFor="confirm">{t(l, "people.person.deactivate.confirm")}</label>
          </div>
          <Button type="submit" variant="secondary">{t(l, "people.person.deactivate")}</Button>
        </form>
      )}
    </Shell>
  );
}
