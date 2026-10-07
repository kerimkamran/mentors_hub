import { Shell } from "@/components/Shell";
import { Alert, Button, Card, Field, Heading } from "@/components/ui";
import { getAvailabilityPage, type StoredRule } from "@/domain/availability/queries";
import { capacityLimits } from "@/domain/profiles/settings";
import { requireActor } from "@/lib/auth/http";
import { withOrg } from "@/lib/db";
import { catalogue, formatDate, formatDateTime, t } from "@/lib/i18n";
import { knownErrKey } from "../../_form";
import { addAwayAction, addRuleAction, removeAwayAction, removeRuleAction, setCapacityAction } from "./actions";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const selectCls = "min-h-11 rounded-md border border-neutral-400 bg-transparent px-2";

export default async function AvailabilityPage({ searchParams }: { searchParams: SP }) {
  const actor = await requireActor();
  const l = actor.locale;
  const sp = await searchParams;
  const errKey = knownErrKey(first(sp.err), (k) => k in catalogue("en"));
  const page = await getAvailabilityPage(actor);
  const limits = await withOrg(actor.organisationId, async (tx) => Object.fromEntries(await Promise.all(page.capacities.map(async (c) => [c.participationId, await capacityLimits(tx, c.programmeType)] as const))));
  // 2024-01-01 is a Monday: used only to get localised weekday names (Monday first, C-111).
  const weekdayName = (n: number) => new Intl.DateTimeFormat(l === "az" ? "az-AZ" : l === "ru" ? "ru-RU" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, n)));
  const rangeText = (r: StoredRule) => t(l, "avl.range", { day: weekdayName(r.weekday), start: r.start, end: r.end, zone: r.timeZone });

  const ruleForm = (kind: "rule" | "window") => (
    <form action={addRuleAction} className="mt-3 flex flex-wrap items-end gap-3">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-col gap-1"><label htmlFor={`wd-${kind}`} className="font-medium">{t(l, "avl.weekday")}</label>
        <select id={`wd-${kind}`} name="weekday" className={selectCls}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{weekdayName(n)}</option>)}</select></div>
      <Field label={t(l, "avl.start")} name="start" required pattern="[0-2]?[0-9]:[0-5][0-9]" maxLength={5} hint={t(l, "avl.time.hint")} defaultValue="09:00" />
      <Field label={t(l, "avl.end")} name="end" required pattern="[0-2]?[0-9]:[0-5][0-9]" maxLength={5} hint={t(l, "avl.time.hint")} defaultValue="12:00" />
      <Field label={t(l, "avl.time_zone")} name="time_zone" required maxLength={64} hint={t(l, "avl.tz.hint")} defaultValue={actor.timeZone} />
      <Field label={t(l, "avl.valid_from")} name="valid_from" type="date" required={false} />
      <Field label={t(l, "avl.valid_to")} name="valid_to" type="date" required={false} />
      <Button type="submit">{t(l, "avl.add")}</Button>
    </form>
  );
  const ruleList = (rules: StoredRule[], kind: "rule" | "window") =>
    rules.length === 0 ? <p className="mt-2">{t(l, "avl.empty")}</p> : (
      <ul className="mt-2 flex flex-col gap-2">
        {rules.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2">
            <span>{rangeText(r)}</span>
            <form action={removeRuleAction}><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={r.id} />
              <Button type="submit" variant="secondary">{t(l, "avl.remove")}<span className="sr-only"> {rangeText(r)}</span></Button></form>
          </li>
        ))}
      </ul>
    );

  return (
    <Shell wide>
      <Heading>{t(l, "avl.title")}</Heading>
      <p className="mt-2 max-w-prose">{t(l, "avl.intro")}</p>
      <p className="mt-1 max-w-prose text-sm opacity-80">{t(l, "avl.keep")}</p>
      {errKey && <div className="mt-4"><Alert kind="error">{t(l, errKey)}</Alert></div>}
      {first(sp.saved) && <div className="mt-4"><Alert kind="success">{t(l, "prf.status.saved")}</Alert></div>}
      {first(sp.cap) === "ok" && <div className="mt-4"><Alert kind="success">{t(l, "avl.capacity.saved")}</Alert></div>}
      {first(sp.cap) === "below" && <div className="mt-4"><Alert>{t(l, "avl.capacity.warned")}</Alert></div>}

      {page.isMentor && (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">{t(l, "avl.mentor.title")}</h2>
          {ruleList(page.rules, "rule")}
          {ruleForm("rule")}
        </Card>
      )}

      {page.isMentor && page.capacities.length > 0 && (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">{t(l, "avl.capacity.title")}</h2>
          {page.capacities.map((c) => (
            <form key={c.participationId} action={setCapacityAction} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="participation_id" value={c.participationId} />
              <div className="flex flex-col gap-1">
                <label htmlFor={`cap-${c.participationId}`} className="font-medium">{t(l, "avl.capacity.label", { programme: c.programmeName })}</label>
                <input id={`cap-${c.participationId}`} name="capacity" type="number" inputMode="numeric" min={0} max={limits[c.participationId]?.maximum} step={1}
                  defaultValue={c.capacity ?? limits[c.participationId]?.default} aria-describedby={`cap-h-${c.participationId}`}
                  className="min-h-11 w-28 rounded-md border border-neutral-400 bg-transparent px-3" />
                <p id={`cap-h-${c.participationId}`} className="text-sm opacity-80">
                  {t(l, "avl.capacity.hint", { load: c.load, max: limits[c.participationId]?.maximum ?? 0 })} {t(l, "avl.capacity.warn")}
                </p>
              </div>
              <Button type="submit">{t(l, "avl.capacity.save")}</Button>
            </form>
          ))}
        </Card>
      )}

      {page.isMentee && (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">{t(l, "avl.mentee.title")}</h2>
          {ruleList(page.windows, "window")}
          {ruleForm("window")}
        </Card>
      )}

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">{t(l, "avl.away.title")}</h2>
        <p className="mt-1 text-sm opacity-80">{t(l, "avl.away.hint")}</p>
        {page.exceptions.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2">
            {page.exceptions.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <span>{formatDate(e.startsAt, l, actor.timeZone)} – {formatDate(new Date(e.endsAt.getTime() - 1), l, actor.timeZone)}</span>
                <form action={removeAwayAction}><input type="hidden" name="id" value={e.id} /><Button type="submit" variant="secondary">{t(l, "avl.remove")}<span className="sr-only"> {formatDateTime(e.startsAt, l, actor.timeZone)}</span></Button></form>
              </li>
            ))}
          </ul>
        )}
        <form action={addAwayAction} className="mt-3 flex flex-wrap items-end gap-3">
          <Field label={t(l, "avl.away.from")} name="from" type="date" />
          <Field label={t(l, "avl.away.to")} name="to" type="date" />
          <Button type="submit">{t(l, "avl.away.add")}</Button>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">{t(l, "avl.preview.title")}</h2>
        {page.preview.length === 0 ? <p className="mt-2">{t(l, "avl.preview.none")}</p> : (
          <div className="mt-2 flex flex-col gap-3">
            {page.preview.map((d) => (
              <section key={d.date} aria-labelledby={`d-${d.date}`}>
                <h3 id={`d-${d.date}`} className="font-medium">{formatDate(new Date(`${d.date}T12:00:00Z`), l, "UTC")}</h3>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {d.slots.map((s) => <li key={s.startUtc} className="rounded-md border border-neutral-400 px-3 py-2">{t(l, "avl.preview.slot", { start: s.localStart, end: s.localEnd })}</li>)}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </Shell>
  );
}
