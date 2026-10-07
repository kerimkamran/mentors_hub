import type { Tx } from "@/lib/db";
import type { Locale } from "@/lib/constants";
import { likeEscape, queryKey } from "../profiles/search";
import { INTEREST_CATALOGUE, TAXONOMY_CATALOGUE } from "./catalogue";

export interface TopicRef {
  id: string;
  parentId: string | null;
  key: string | null;
  /** Name in the requested language. */
  name: string;
  parentName: string | null;
}

export interface TopicRow {
  id: string; parent_id: string | null; catalogue_key: string | null;
  name_en: string; name_az: string; name_ru: string;
  p_name_en: string | null; p_name_az: string | null; p_name_ru: string | null;
}

const nameOf = (r: { name_en: string; name_az: string; name_ru: string }, l: Locale) => (l === "az" ? r.name_az : l === "ru" ? r.name_ru : r.name_en);
const pNameOf = (r: TopicRow, l: Locale) => (r.parent_id === null ? null : l === "az" ? r.p_name_az : l === "ru" ? r.p_name_ru : r.p_name_en);

export const toTopicRef = (r: TopicRow, l: Locale): TopicRef => ({ id: r.id, parentId: r.parent_id, key: r.catalogue_key, name: nameOf(r, l), parentName: pNameOf(r, l) });

const TOPIC_COLS = `t.id, t.parent_id, t.catalogue_key, t.name_en, t.name_az, t.name_ru, p.name_en AS p_name_en, p.name_az AS p_name_az, p.name_ru AS p_name_ru`;
const TOPIC_FROM = `taxonomy_topic t LEFT JOIN taxonomy_topic p ON p.id = t.parent_id AND p.organisation_id = t.organisation_id`;

/**
 * Copies the platform catalogue into the organisation (idempotent; never overwrites an organisation's edits).
 * Called before the first taxonomy read; the integrator should also call it when an organisation is created.
 */
export async function ensureTaxonomy(tx: Tx, organisationId: string): Promise<void> {
  const expected = TAXONOMY_CATALOGUE.reduce((n, a) => n + 1 + a.children.length, 0);
  const have = await tx.query<{ n: number; i: number }>(
    `SELECT (SELECT count(*)::int FROM taxonomy_topic WHERE catalogue_key IS NOT NULL) AS n,
            (SELECT count(*)::int FROM interest_tag WHERE catalogue_key IS NOT NULL) AS i`,
  );
  if (have.rows[0]!.n >= expected && have.rows[0]!.i >= INTEREST_CATALOGUE.length) return;
  let order = 0;
  for (const area of TAXONOMY_CATALOGUE) {
    await upsertTopic(tx, organisationId, area, null, order++);
    for (const child of area.children) await upsertTopic(tx, organisationId, child, area.key, order++);
  }
  let i = 0;
  for (const it of INTEREST_CATALOGUE) {
    await tx.query(
      `INSERT INTO interest_tag (organisation_id, catalogue_key, name_en, name_az, name_ru, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (organisation_id, catalogue_key) DO NOTHING`,
      [organisationId, it.key, it.en, it.az, it.ru, i++],
    );
  }
}

async function upsertTopic(tx: Tx, orgId: string, t: { key: string; en: string; az: string; ru: string; syn?: { en?: string[]; az?: string[]; ru?: string[] } }, parentKey: string | null, order: number) {
  await tx.query(
    `INSERT INTO taxonomy_topic (organisation_id, parent_id, catalogue_key, name_en, name_az, name_ru, synonyms_en, synonyms_az, synonyms_ru, sort_order)
     VALUES ($1, (SELECT id FROM taxonomy_topic WHERE catalogue_key = $2), $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (organisation_id, catalogue_key) DO NOTHING`,
    [orgId, parentKey, t.key, t.en, t.az, t.ru, t.syn?.en ?? [], t.syn?.az ?? [], t.syn?.ru ?? [], order],
  );
}

export interface TopicHit extends TopicRef {
  /** A synonym that matched, when the name itself did not (so the picker can say "matched: managing people"). */
  matchedSynonym: string | null;
}

/**
 * Topic search for the picker (AC-PRF-01.1, AC-PRF-01.3). Accent-folding (C-115 plus ə as a) over names and synonyms in all
 * three languages; the person's own language ranks first. An empty query lists the areas.
 */
export async function searchTopics(tx: Tx, o: { query: string; locale: Locale; limit?: number; includeAreas?: boolean }): Promise<TopicHit[]> {
  const limit = Math.min(Math.max(o.limit ?? 20, 1), 100);
  const words = queryKey(o.query).split(" ").filter(Boolean).slice(0, 6);
  const params: unknown[] = [];
  const clauses: string[] = [];
  for (const w of words) {
    params.push(`%${likeEscape(w)}%`);
    const ph = `$${params.length}`;
    const hay = (l: "en" | "az" | "ru") =>
      `mh_search_key(t.name_${l} || ' ' || coalesce(array_to_string(t.synonyms_${l}, ' '), '') || ' ' || coalesce(p.name_${l}, '') || ' ' || coalesce(array_to_string(p.synonyms_${l}, ' '), '')) LIKE ${ph} ESCAPE '\\'`;
    clauses.push(`(${hay("en")} OR ${hay("az")} OR ${hay("ru")})`);
  }
  const where = ["t.is_active", ...(o.includeAreas === false ? ["t.parent_id IS NOT NULL"] : []), ...clauses].join(" AND ");
  const r = await tx.query<TopicRow & { syn_en: string[]; syn_az: string[]; syn_ru: string[] }>(
    `SELECT ${TOPIC_COLS}, t.synonyms_en AS syn_en, t.synonyms_az AS syn_az, t.synonyms_ru AS syn_ru
       FROM ${TOPIC_FROM} WHERE ${where} ORDER BY t.sort_order LIMIT 300`,
    params,
  );
  const hits = r.rows.map((row) => {
    const ref = toTopicRef(row, o.locale);
    const own = queryKey(ref.name);
    let rank: number;
    let syn: string | null = null;
    if (words.length === 0) rank = 0;
    else if (words.every((w) => own.startsWith(w) || own.split(" ").some((x) => x.startsWith(w)))) rank = 0;
    else if (words.every((w) => queryKey(ref.name).includes(w))) rank = 1;
    else {
      const synList = o.locale === "az" ? row.syn_az : o.locale === "ru" ? row.syn_ru : row.syn_en;
      syn = synList.find((s) => words.every((w) => queryKey(s).includes(w))) ?? null;
      rank = syn ? 2 : 3;
    }
    return { hit: { ...ref, matchedSynonym: syn } as TopicHit, rank };
  });
  hits.sort((a, b) => a.rank - b.rank); // stable: keeps catalogue order inside a rank
  return hits.slice(0, limit).map((h) => h.hit);
}

export interface TaxonomyArea extends TopicRef { children: TopicRef[] }

/** The whole active taxonomy as a tree in one language (checkbox lists such as expertise areas). */
export async function listTaxonomy(tx: Tx, locale: Locale): Promise<TaxonomyArea[]> {
  const r = await tx.query<TopicRow>(`SELECT ${TOPIC_COLS} FROM ${TOPIC_FROM} WHERE t.is_active ORDER BY t.sort_order`);
  const areas = new Map<string, TaxonomyArea>();
  for (const row of r.rows) if (row.parent_id === null) areas.set(row.id, { ...toTopicRef(row, locale), children: [] });
  for (const row of r.rows) if (row.parent_id !== null) areas.get(row.parent_id)?.children.push(toTopicRef(row, locale));
  return [...areas.values()];
}

export async function getTopicRefs(tx: Tx, ids: string[], locale: Locale): Promise<TopicRef[]> {
  if (ids.length === 0) return [];
  const r = await tx.query<TopicRow>(`SELECT ${TOPIC_COLS} FROM ${TOPIC_FROM} WHERE t.id = ANY($1::uuid[])`, [ids]);
  return r.rows.map((x) => toTopicRef(x, locale));
}

export interface InterestRef { id: string; key: string | null; name: string }

export async function listInterests(tx: Tx, locale: Locale): Promise<InterestRef[]> {
  const r = await tx.query<{ id: string; catalogue_key: string | null; name_en: string; name_az: string; name_ru: string }>(
    "SELECT id, catalogue_key, name_en, name_az, name_ru FROM interest_tag WHERE is_active ORDER BY sort_order",
  );
  return r.rows.map((x) => ({ id: x.id, key: x.catalogue_key, name: nameOf(x, locale) }));
}
