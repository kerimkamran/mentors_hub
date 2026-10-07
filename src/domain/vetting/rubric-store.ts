import { audit } from "@/lib/audit";
import { withOrg, type Tx } from "@/lib/db";
import { authorize, type Actor } from "@/lib/permissions";
import { maxTotal, validateRubric, type RubricBand, type RubricDefinition, type RubricSection } from "./rubric";
import { RUBRIC_SEEDS, seedDefinition } from "./rubric-data";

export interface RubricVersion extends RubricDefinition {
  id: string;
  code: string;
  version: number;
  name: string;
  maxTotal: number;
  immutableSince: Date | null;
}

interface Row {
  id: string; code: string; version: number; name: string; sections: RubricSection[]; bands: RubricBand[]; max_total: number; immutable_since: Date | null;
}
const map = (r: Row): RubricVersion => ({
  id: r.id, code: r.code, version: r.version, name: r.name, sections: r.sections, bands: r.bands, maxTotal: r.max_total, immutableSince: r.immutable_since,
});

/** Seeds both rubrics for the organisation in context if missing (FR-VET-004). Idempotent; safe to call on every read path. */
export async function ensureRubrics(tx: Tx, organisationId: string): Promise<void> {
  for (const seed of RUBRIC_SEEDS) {
    const def = seedDefinition(seed);
    await tx.query(
      `INSERT INTO rubric_version (organisation_id, code, version, name, sections, bands, max_total)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       ON CONFLICT (organisation_id, code, version) DO NOTHING`,
      [organisationId, seed.code, seed.version, seed.name, JSON.stringify(def.sections), JSON.stringify(def.bands), maxTotal(def)],
    );
  }
}

/** The newest version of a rubric code (seeding first). Programme types leadership and sparklab map to the rubric of the same code. */
export async function latestRubric(tx: Tx, organisationId: string, code: string): Promise<RubricVersion | null> {
  await ensureRubrics(tx, organisationId);
  const r = await tx.query<Row>("SELECT * FROM rubric_version WHERE code = $1 ORDER BY version DESC LIMIT 1", [code]);
  return r.rows[0] ? map(r.rows[0]) : null;
}

export async function getRubric(tx: Tx, id: string): Promise<RubricVersion | null> {
  const r = await tx.query<Row>("SELECT * FROM rubric_version WHERE id = $1", [id]);
  return r.rows[0] ? map(r.rows[0]) : null;
}

export async function listRubricVersions(tx: Tx, organisationId: string): Promise<RubricVersion[]> {
  await ensureRubrics(tx, organisationId);
  const r = await tx.query<Row>("SELECT * FROM rubric_version ORDER BY code, version DESC");
  return r.rows.map(map);
}

export type NewRubricResult = { ok: true; id: string; version: number } | { ok: false; problems: string[] };

/**
 * Creates the next version of a rubric (matrix §4.7: content manager or org admin). A rubric is never edited in place:
 * a change is a new row, so versions already used by assessments keep their meaning (FR-VET-003).
 */
export async function createRubricVersion(actor: Actor, input: { code: string; name: string } & RubricDefinition): Promise<NewRubricResult> {
  authorize(actor, "vetting.rubric.version");
  const problems = validateRubric(input);
  if (problems.length) return { ok: false, problems };
  return withOrg(actor.organisationId, async (tx) => {
    await ensureRubrics(tx, actor.organisationId);
    const v = await tx.query<{ v: number | null }>("SELECT max(version) AS v FROM rubric_version WHERE code = $1", [input.code]);
    const version = (v.rows[0]?.v ?? 0) + 1;
    const r = await tx.query<{ id: string }>(
      `INSERT INTO rubric_version (organisation_id, code, version, name, sections, bands, max_total, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8) RETURNING id`,
      [actor.organisationId, input.code, version, input.name, JSON.stringify(input.sections), JSON.stringify(input.bands), maxTotal(input), actor.membershipId],
    );
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: "vetting.rubric.version", objectType: "rubric_version", objectId: r.rows[0]!.id });
    return { ok: true as const, id: r.rows[0]!.id, version };
  });
}
