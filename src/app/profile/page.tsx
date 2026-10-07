import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Alert, Button, Card, Heading } from "@/components/ui";
import { BIO_MAX, DEPTHS, HEADLINE_MAX, LANGUAGE_CODES, PROFICIENCIES, type VisibilityField } from "@/domain/profiles/constants";
import { prepareTaxonomy } from "@/domain/profiles/commands";
import { getMatchingView } from "@/domain/profiles/matching-view";
import { getMyParticipationKinds, getOwnProfile } from "@/domain/profiles/queries";
import { mentorChecklist } from "@/domain/profiles/recommendable";
import { listInterests, listTaxonomy, searchTopics } from "@/domain/taxonomy/queries";
import { requireActor } from "@/lib/auth/http";
import { withOrg } from "@/lib/db";
import { catalogue, t } from "@/lib/i18n";
import { knownErrKey } from "../_form";
import { addTopic, deleteLanguage, removeTopic, saveAreas, saveInterests, saveLanguage, saveText } from "./actions";
import { AutosaveText } from "./AutosaveText";
import { levelLabel, VisibilityControl, type KindsKey } from "./VisibilityControl";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const selectCls = "min-h-11 rounded-md border border-neutral-400 bg-transparent px-2";

export default async function ProfilePage({ searchParams }: { searchParams: SP }) {
  const actor = await requireActor();
  const l = actor.locale;
  const sp = await searchParams;
  const tq = (first(sp.tq) ?? "").slice(0, 80);
  const role = first(sp.role) === "seeks" ? "seeks" : "offers";
  const errKey = knownErrKey(first(sp.err), (k) => k in catalogue("en"));

  await prepareTaxonomy(actor); // reference data only (idempotent catalogue copy); the integrator also seeds at organisation creation
  const [profile, kinds, checklist, matching] = await Promise.all([getOwnProfile(actor), getMyParticipationKinds(actor), mentorChecklist(actor), getMatchingView(actor)]);
  const { areas, interests, results } = await withOrg(actor.organisationId, async (tx) => ({
    areas: await listTaxonomy(tx, l),
    interests: await listInterests(tx, l),
    results: tq ? await searchTopics(tx, { query: tq, locale: l, limit: 12 }) : [],
  }));

  const kindsKey: KindsKey = kinds.has("mentor") && !kinds.has("mentee") && !kinds.has("team_member") ? "mentor" : !kinds.has("mentor") && kinds.size > 0 ? "mentee" : "both";
  const isMentor = kinds.has("mentor") || kinds.size === 0;
  const langName = new Intl.DisplayNames([l], { type: "language" });
  const vis = (field: VisibilityField) => <VisibilityControl field={field} level={profile.levels[field]} locale={l} kinds={kindsKey} />;
  const draft = profile.draft;
  const text = { bio: draft?.bio ?? profile.bio ?? "", headline: draft?.headline ?? profile.headline ?? "" };
  const audienceText = (a: "only_me" | "counterparts" | "matched") =>
    a === "counterparts" ? levelLabel(l, "programme_counterparts", kindsKey) : a === "matched" ? levelLabel(l, "request_or_match", kindsKey) : levelLabel(l, "only_me", kindsKey);
  const fieldRowName = (f: string) => (f === "goals" ? t(l, "prf.matching.goals") : f === "capacity" ? t(l, "prf.matching.capacity") : t(l, `prf.field.${f}`));

  return (
    <Shell wide>
      <Heading>{t(l, "prf.title")}</Heading>
      <p className="mt-2 max-w-prose">{t(l, "prf.intro")}</p>
      <p className="mt-1 max-w-prose text-sm opacity-80">{t(l, "prf.visibility.hint")}</p>
      {errKey && <div className="mt-4"><Alert kind="error">{t(l, errKey)}</Alert></div>}
      {first(sp.saved) && <div className="mt-4"><Alert kind="success">{t(l, "prf.status.saved")}</Alert></div>}

      {checklist && (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">{t(l, "prf.complete.title")}</h2>
          {checklist.recommendable ? <p className="mt-1">{t(l, "prf.complete.ok")}</p> : <p className="mt-1">{t(l, "prf.complete.body")}</p>}
          <ul className="mt-2 flex flex-col gap-1">
            <li><span aria-hidden>{checklist.hasTopics ? "✓" : "✗"}</span> {t(l, "prf.complete.topics")} — {t(l, checklist.hasTopics ? "prf.complete.done" : "prf.complete.missing")}</li>
            <li><span aria-hidden>{checklist.hasExpertiseArea ? "✓" : "✗"}</span> {t(l, "prf.complete.area")} — {t(l, checklist.hasExpertiseArea ? "prf.complete.done" : "prf.complete.missing")}</li>
          </ul>
          {checklist.topicsHiddenFromMatching && <p className="mt-2">{t(l, "prf.complete.hidden")}</p>}
        </Card>
      )}

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">{t(l, "prf.basics.title")}</h2>
        <p className="mt-1 text-sm opacity-80">{t(l, "prf.basics.note")}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="font-medium">{t(l, "prf.basics.name")}</dt><dd>{profile.displayName}</dd>
          <dt className="font-medium">{t(l, "prf.basics.department")}</dt><dd>{profile.department ?? "—"}</dd>
          <dt className="font-medium">{t(l, "prf.basics.job_title")}</dt><dd>{profile.jobTitle ?? "—"}</dd>
        </dl>
        {vis("name")}{vis("department")}{vis("job_title")}
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">{t(l, "prf.langtz.title")}</h2>
        <p className="mt-2"><Link href="/settings" className="underline">{t(l, "prf.langtz.link")}</Link></p>
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">{t(l, "prf.about.title")}</h2>
        {draft && <div className="mt-2"><Alert>{t(l, "prf.draft_restored")}</Alert></div>}
        <AutosaveText
          action={saveText} initial={text} maxBio={BIO_MAX} maxHeadline={HEADLINE_MAX}
          labels={{
            headline: t(l, "prf.about.headline"), headlineHint: t(l, "prf.about.headline.hint"), bio: t(l, "prf.about.bio"), save: t(l, "prf.about.save"),
            saving: t(l, "prf.status.saving"), saved: t(l, "prf.status.saved"), failed: t(l, "prf.status.failed"),
          }}
        />
        {vis("headline")}{vis("bio")}
      </Card>

      {(["offers", "seeks"] as const).map((r) => (
        <Card key={r} className="mt-6">
          <h2 id={r} className="text-lg font-semibold">{t(l, r === "offers" ? "prf.offers.title" : "prf.seeks.title")}</h2>
          {(r === "offers" ? profile.offers.length : profile.seeks.length) === 0 && <p className="mt-2">{t(l, r === "offers" ? "prf.offers.empty" : "prf.seeks.empty")}</p>}
          <ul className="mt-2 flex flex-col gap-2">
            {(r === "offers" ? profile.offers.map((o) => ({ topic: o.topic, depth: o.depth as string | null })) : profile.seeks.map((x) => ({ topic: x, depth: null as string | null }))).map(({ topic, depth }) => (
              <li key={topic.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{topic.name}</span>
                {topic.parentName && <span className="text-sm opacity-80">{t(l, "prf.topic.in", { area: topic.parentName })}</span>}
                {r === "offers" && (
                  <form action={addTopic} className="flex items-center gap-2">
                    <input type="hidden" name="topic_id" value={topic.id} /><input type="hidden" name="role" value="offers" />
                    <label htmlFor={`d-${topic.id}`} className="sr-only">{t(l, "prf.topic.depth")}</label>
                    <select id={`d-${topic.id}`} name="depth" defaultValue={depth ?? "working"} className={selectCls}>
                      {DEPTHS.map((d) => <option key={d} value={d}>{t(l, `prf.depth.${d}`)}</option>)}
                    </select>
                    <Button type="submit" variant="secondary">{t(l, "prf.topic.update")}</Button>
                  </form>
                )}
                <form action={removeTopic}>
                  <input type="hidden" name="topic_id" value={topic.id} /><input type="hidden" name="role" value={r} />
                  <Button type="submit" variant="secondary">{t(l, "prf.topic.remove")}<span className="sr-only"> {topic.name}</span></Button>
                </form>
              </li>
            ))}
          </ul>
          {vis(r === "offers" ? "topics_offered" : "topics_sought")}
          <form method="get" action="/profile" className="mt-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="role" value={r} />
            <div className="flex flex-col gap-1">
              <label htmlFor={`tq-${r}`} className="font-medium">{t(l, "prf.topic.search")}</label>
              <input id={`tq-${r}`} name="tq" defaultValue={role === r ? tq : ""} maxLength={80} aria-describedby={`tq-hint-${r}`} className="min-h-11 rounded-md border border-neutral-400 bg-transparent px-3" />
            </div>
            <Button type="submit" variant="secondary">{t(l, "prf.topic.search.submit")}</Button>
            <p id={`tq-hint-${r}`} className="basis-full text-sm opacity-80">{t(l, "prf.topic.search.hint")}</p>
          </form>
          {tq && role === r && (
            <div className="mt-3" aria-live="polite">
              <h3 className="font-medium">{t(l, "prf.topic.results")}</h3>
              {results.length === 0 && <p>{t(l, "prf.topic.none")}</p>}
              <ul className="mt-1 flex flex-col gap-2">
                {results.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{h.name}</span>
                    {h.parentName && <span className="text-sm opacity-80">{t(l, "prf.topic.in", { area: h.parentName })}</span>}
                    {h.matchedSynonym && <span className="text-sm opacity-80">{t(l, "prf.topic.matched", { synonym: h.matchedSynonym })}</span>}
                    <form action={addTopic} className="flex items-center gap-2">
                      <input type="hidden" name="topic_id" value={h.id} /><input type="hidden" name="role" value={r} /><input type="hidden" name="tq" value={tq} />
                      {r === "offers" && (
                        <>
                          <label htmlFor={`nd-${h.id}`} className="sr-only">{t(l, "prf.topic.depth")}</label>
                          <select id={`nd-${h.id}`} name="depth" defaultValue="working" className={selectCls}>
                            {DEPTHS.map((d) => <option key={d} value={d}>{t(l, `prf.depth.${d}`)}</option>)}
                          </select>
                        </>
                      )}
                      <Button type="submit">{t(l, "prf.topic.add")}<span className="sr-only"> {h.name}</span></Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ))}

      {isMentor && (
        <Card className="mt-6">
          <h2 id="areas" className="text-lg font-semibold">{t(l, "prf.areas.title")}</h2>
          <p className="mt-1 text-sm opacity-80">{t(l, "prf.areas.hint")}</p>
          <form action={saveAreas} className="mt-3 flex flex-col gap-2">
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{t(l, "prf.areas.title")}</legend>
              {areas.map((a) => (
                <label key={a.id} className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" name="area" value={a.id} defaultChecked={profile.expertiseAreas.some((x) => x.id === a.id)} className="size-5" />
                  <span>{a.name}</span>
                </label>
              ))}
            </fieldset>
            <div><Button type="submit">{t(l, "prf.areas.save")}</Button></div>
          </form>
        </Card>
      )}

      <Card className="mt-6">
        <h2 id="languages" className="text-lg font-semibold">{t(l, "prf.languages.title")}</h2>
        {profile.languages.length === 0 && <p className="mt-2">{t(l, "prf.languages.empty")}</p>}
        <ul className="mt-2 flex flex-col gap-2">
          {profile.languages.map((x) => (
            <li key={x.language} className="flex flex-wrap items-center gap-2">
              <span className="font-medium" lang={x.language}>{langName.of(x.language) ?? x.language}</span>
              <span>{t(l, `prf.level.${x.level}`)}</span>
              <form action={deleteLanguage}><input type="hidden" name="language" value={x.language} /><Button type="submit" variant="secondary">{t(l, "prf.languages.remove")}<span className="sr-only"> {langName.of(x.language)}</span></Button></form>
            </li>
          ))}
        </ul>
        <form action={saveLanguage} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1"><label htmlFor="lang-new" className="font-medium">{t(l, "prf.languages.language")}</label>
            <select id="lang-new" name="language" className={selectCls}>{LANGUAGE_CODES.map((c) => <option key={c} value={c}>{langName.of(c) ?? c}</option>)}</select></div>
          <div className="flex flex-col gap-1"><label htmlFor="lang-level" className="font-medium">{t(l, "prf.languages.level")}</label>
            <select id="lang-level" name="level" className={selectCls}>{PROFICIENCIES.map((p) => <option key={p} value={p}>{t(l, `prf.level.${p}`)}</option>)}</select></div>
          <Button type="submit">{t(l, "prf.languages.add")}</Button>
        </form>
        {vis("languages")}
      </Card>

      <Card className="mt-6">
        <h2 id="interests" className="text-lg font-semibold">{t(l, "prf.interests.title")}</h2>
        <form action={saveInterests} className="mt-2 flex flex-col gap-2">
          <fieldset>
            <legend className="text-sm opacity-80">{t(l, "prf.interests.hint")}</legend>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {interests.map((i) => (
                <label key={i.id} className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" name="interest" value={i.id} defaultChecked={profile.interests.some((x) => x.id === i.id)} className="size-5" />
                  <span>{i.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div><Button type="submit">{t(l, "prf.interests.save")}</Button></div>
        </form>
        {vis("interests")}
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">{t(l, "prf.field.availability")}</h2>
        <p className="mt-2"><Link href="/profile/availability" className="underline">{t(l, "prf.availability.link")}</Link></p>
        {vis("availability")}
      </Card>

      <Card className="mt-6">
        <h2 id="matching" className="text-lg font-semibold">{t(l, "prf.matching.title")}</h2>
        <p className="mt-1 max-w-prose">{t(l, "prf.matching.intro")}</p>
        {matching.readable.length === 0 ? (
          <p className="mt-3">{t(l, "prf.matching.none")}</p>
        ) : (
          <table className="mt-3 w-full text-left">
            <thead><tr><th scope="col" className="py-1">{t(l, "prf.matching.col.detail")}</th><th scope="col">{t(l, "prf.matching.col.audience")}</th></tr></thead>
            <tbody>
              {matching.readable.map((r) => (
                <tr key={r.field} className="border-t border-neutral-300 dark:border-neutral-700"><th scope="row" className="py-2 pr-3 font-normal">{fieldRowName(r.field)}</th><td>{audienceText(r.audience)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {matching.notUsed.length > 0 && (
          <p className="mt-3 text-sm">{t(l, "prf.matching.unused")} {matching.notUsed.map((f) => fieldRowName(f)).join(", ")}</p>
        )}
      </Card>
    </Shell>
  );
}
