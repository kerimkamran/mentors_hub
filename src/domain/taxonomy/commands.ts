import { audit } from "@/lib/audit";
import { withOrg } from "@/lib/db";
import { authorize, NotFoundError, type Actor } from "@/lib/permissions";
import { ValidationError } from "../profiles/errors";
import { ensureTaxonomy } from "./queries";

export { ValidationError };

export interface TopicNames { en: string; az: string; ru: string }
export interface TopicSynonyms { en?: string[]; az?: string[]; ru?: string[] }


const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");
const cleanSyn = (l?: string[]) => [...new Set((l ?? []).map(cleanName).filter((x) => x.length > 0 && x.length <= 60))].slice(0, 20);

function checkNames(n: TopicNames): TopicNames {
  const out = { en: cleanName(n.en), az: cleanName(n.az), ru: cleanName(n.ru) };
  for (const v of Object.values(out)) if (v.length < 1 || v.length > 120) throw new ValidationError("topic.name");
  return out; // all three languages are mandatory (FR-PRF-002)
}

/** An organisation adds its own topic (an "override" of the curated catalogue). Org admin and content manager (matrix §4.3). */
export async function addTopic(actor: Actor, input: { parentId: string | null; names: TopicNames; synonyms?: TopicSynonyms }): Promise<string> {
  authorize(actor, "taxonomy.edit");
  const names = checkNames(input.names);
  return withOrg(actor.organisationId, async (tx) => {
    await ensureTaxonomy(tx, actor.organisationId);
    if (input.parentId) {
      const p = await tx.query("SELECT 1 FROM taxonomy_topic WHERE id = $1 AND parent_id IS NULL", [input.parentId]);
      if (!p.rowCount) throw new NotFoundError();
    }
    const r = await tx.query<{ id: string }>(
      `INSERT INTO taxonomy_topic (organisation_id, parent_id, name_en, name_az, name_ru, synonyms_en, synonyms_az, synonyms_ru, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 10000) RETURNING id`,
      [actor.organisationId, input.parentId, names.en, names.az, names.ru, cleanSyn(input.synonyms?.en), cleanSyn(input.synonyms?.az), cleanSyn(input.synonyms?.ru)],
    );
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "taxonomy.topic_add", objectType: "taxonomy_topic", objectId: r.rows[0]!.id });
    return r.rows[0]!.id;
  });
}

export async function updateTopic(
  actor: Actor,
  topicId: string,
  patch: { names?: TopicNames; synonyms?: TopicSynonyms; isActive?: boolean },
): Promise<void> {
  authorize(actor, "taxonomy.edit");
  await withOrg(actor.organisationId, async (tx) => {
    const cur = await tx.query<{ name_en: string; name_az: string; name_ru: string; synonyms_en: string[]; synonyms_az: string[]; synonyms_ru: string[]; is_active: boolean }>(
      "SELECT name_en, name_az, name_ru, synonyms_en, synonyms_az, synonyms_ru, is_active FROM taxonomy_topic WHERE id = $1 FOR UPDATE",
      [topicId],
    );
    const c = cur.rows[0];
    if (!c) throw new NotFoundError();
    const names = patch.names ? checkNames(patch.names) : { en: c.name_en, az: c.name_az, ru: c.name_ru };
    await tx.query(
      `UPDATE taxonomy_topic SET name_en = $2, name_az = $3, name_ru = $4, synonyms_en = $5, synonyms_az = $6, synonyms_ru = $7, is_active = $8, updated_at = now() WHERE id = $1`,
      [
        topicId, names.en, names.az, names.ru,
        patch.synonyms?.en ? cleanSyn(patch.synonyms.en) : c.synonyms_en,
        patch.synonyms?.az ? cleanSyn(patch.synonyms.az) : c.synonyms_az,
        patch.synonyms?.ru ? cleanSyn(patch.synonyms.ru) : c.synonyms_ru,
        patch.isActive ?? c.is_active,
      ],
    );
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "taxonomy.topic_update", objectType: "taxonomy_topic", objectId: topicId });
  });
}
