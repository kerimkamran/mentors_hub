/**
 * Profile writes (US-PRF-01, US-PRF-02). Every command acts on the signed-in person's OWN profile: the organisation and the
 * person come from the Actor (INV-1.5); nothing here accepts a membership id from a caller.
 */
import { z } from "zod";
import { audit } from "@/lib/audit";
import { withOrg, type Tx } from "@/lib/db";
import { authorize, type Actor } from "@/lib/permissions";
import { BIO_MAX, DEPTHS, HEADLINE_MAX, LANGUAGE_CODES, MAX_TOPICS_PER_ROLE, PROFICIENCIES, type Depth, type Proficiency, type VisibilityField, type VisibilityLevel } from "./constants";
import { isUuid, ValidationError } from "./errors";
import { isLevel, isVisibilityField, levelAllowed } from "./visibility";
import { ensureTaxonomy } from "../taxonomy/queries";

export { ValidationError };

function own(actor: Actor) {
  authorize(actor, "profile.edit.own", { ownerMembershipId: actor.membershipId });
}

// ------------------------------------------------------------------ visibility (US-PRF-02)
/** Changes who can read one field. Takes effect for the next read (SCR-03 rules) and is audited by id and field code only. */
export async function setFieldVisibility(actor: Actor, field: string, level: string): Promise<void> {
  own(actor);
  if (!isVisibilityField(field) || !isLevel(level)) throw new ValidationError("visibility.invalid");
  if (!levelAllowed(field, level)) throw new ValidationError("visibility.name_not_private");
  await withOrg(actor.organisationId, async (tx) => {
    await tx.query(
      `INSERT INTO profile_field_visibility (organisation_id, membership_id, field, level) VALUES ($1, $2, $3, $4)
       ON CONFLICT (membership_id, field) DO UPDATE SET level = EXCLUDED.level, updated_at = now()`,
      [actor.organisationId, actor.membershipId, field, level],
    );
    await audit(tx, { organisationId: actor.organisationId, actorId: actor.membershipId, action: `profile.visibility.${field}`, objectType: "person_profile", objectId: actor.membershipId });
  });
}

// ------------------------------------------------------------------ text and autosave drafts (FR-PRF-009)
const draftSchema = z.object({ bio: z.string().max(BIO_MAX).optional(), headline: z.string().max(HEADLINE_MAX).optional() }).strict();
export type ProfileTextDraft = z.infer<typeof draftSchema>;

/** Autosave: stores unsent edits of the free-text fields; restored when the person returns (AC-PRF-01.4). */
export async function saveProfileDraft(actor: Actor, payload: unknown): Promise<void> {
  own(actor);
  const parsed = draftSchema.safeParse(payload);
  if (!parsed.success) throw new ValidationError("draft.invalid");
  await withOrg(actor.organisationId, (tx) =>
    tx.query(
      `INSERT INTO profile_draft (organisation_id, membership_id, payload) VALUES ($1, $2, $3)
       ON CONFLICT (membership_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [actor.organisationId, actor.membershipId, JSON.stringify(parsed.data)],
    ),
  );
}

/** "Save": publishes the text to the profile and clears the draft. */
export async function saveProfileText(actor: Actor, input: { bio: string; headline: string }): Promise<void> {
  own(actor);
  const bio = input.bio.trim();
  const headline = input.headline.trim();
  if (bio.length > BIO_MAX || headline.length > HEADLINE_MAX) throw new ValidationError("text.too_long");
  await withOrg(actor.organisationId, async (tx) => {
    await tx.query("UPDATE person_profile SET bio = $2, headline = $3, updated_at = now() WHERE membership_id = $1", [actor.membershipId, bio || null, headline || null]);
    await tx.query("DELETE FROM profile_draft WHERE membership_id = $1", [actor.membershipId]);
  });
}

// ------------------------------------------------------------------ topics (US-PRF-01)
/**
 * Adds or changes a topic from the curated taxonomy. A topic I offer must carry a depth (AC-PRF-01.2); one I seek must not.
 * Only taxonomy ids are accepted: there is no way to enter free text (AC-PRF-01.1).
 */
export async function setPersonTopic(actor: Actor, input: { topicId: string; role: "offers" | "seeks"; depth?: string | null }): Promise<void> {
  own(actor);
  if (input.role !== "offers" && input.role !== "seeks") throw new ValidationError("topic.role");
  let depth: Depth | null = null;
  if (input.role === "offers") {
    if (!input.depth || !(DEPTHS as readonly string[]).includes(input.depth)) throw new ValidationError("topic.depth_required");
    depth = input.depth as Depth;
  }
  await withOrg(actor.organisationId, async (tx) => {
    if (!isUuid(input.topicId)) throw new ValidationError("topic.unknown");
    const t = await tx.query("SELECT 1 FROM taxonomy_topic WHERE id = $1 AND is_active", [input.topicId]);
    if (!t.rowCount) throw new ValidationError("topic.unknown");
    const n = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM person_topic WHERE membership_id = $1 AND role = $2 AND topic_id <> $3", [actor.membershipId, input.role, input.topicId]);
    if (n.rows[0]!.n >= MAX_TOPICS_PER_ROLE) throw new ValidationError("topic.too_many");
    await tx.query(
      `INSERT INTO person_topic (organisation_id, membership_id, topic_id, role, depth) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (membership_id, topic_id, role) DO UPDATE SET depth = EXCLUDED.depth`,
      [actor.organisationId, actor.membershipId, input.topicId, input.role, depth],
    );
  });
}

export async function removePersonTopic(actor: Actor, input: { topicId: string; role: "offers" | "seeks" }): Promise<void> {
  own(actor);
  if (!isUuid(input.topicId)) return;
  await withOrg(actor.organisationId, (tx) =>
    tx.query("DELETE FROM person_topic WHERE membership_id = $1 AND topic_id = $2 AND role = $3", [actor.membershipId, input.topicId, input.role]),
  );
}

/** A mentor's areas of expertise: top-level taxonomy areas (C-032). Replaces the whole selection. */
export async function setExpertiseAreas(actor: Actor, areaIds: string[]): Promise<void> {
  own(actor);
  const ids = [...new Set(areaIds)];
  if (!ids.every(isUuid)) throw new ValidationError("area.unknown");
  await withOrg(actor.organisationId, async (tx) => {
    if (ids.length > 0) {
      const ok = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM taxonomy_topic WHERE id = ANY($1::uuid[]) AND parent_id IS NULL AND is_active", [ids]);
      if (ok.rows[0]!.n !== ids.length) throw new ValidationError("area.unknown");
    }
    await tx.query("DELETE FROM mentor_expertise_area WHERE membership_id = $1", [actor.membershipId]);
    for (const id of ids)
      await tx.query("INSERT INTO mentor_expertise_area (organisation_id, membership_id, topic_id) VALUES ($1, $2, $3)", [actor.organisationId, actor.membershipId, id]);
  });
}

// ------------------------------------------------------------------ languages and interests (FR-PRF-004, FR-PRF-005)
export async function setLanguage(actor: Actor, input: { language: string; level: string }): Promise<void> {
  own(actor);
  if (!(LANGUAGE_CODES as readonly string[]).includes(input.language) || !(PROFICIENCIES as readonly string[]).includes(input.level)) throw new ValidationError("language.invalid");
  await withOrg(actor.organisationId, (tx) =>
    tx.query(
      `INSERT INTO person_language (organisation_id, membership_id, language, level) VALUES ($1, $2, $3, $4)
       ON CONFLICT (membership_id, language) DO UPDATE SET level = EXCLUDED.level`,
      [actor.organisationId, actor.membershipId, input.language, input.level as Proficiency],
    ),
  );
}

export async function removeLanguage(actor: Actor, language: string): Promise<void> {
  own(actor);
  await withOrg(actor.organisationId, (tx) => tx.query("DELETE FROM person_language WHERE membership_id = $1 AND language = $2", [actor.membershipId, language]));
}

/** Interests come from the curated tag list only. Replaces the whole selection. */
export async function setInterests(actor: Actor, interestIds: string[]): Promise<void> {
  own(actor);
  const ids = [...new Set(interestIds)];
  if (!ids.every(isUuid)) throw new ValidationError("interest.unknown");
  await withOrg(actor.organisationId, async (tx) => {
    if (ids.length > 0) {
      const ok = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM interest_tag WHERE id = ANY($1::uuid[]) AND is_active", [ids]);
      if (ok.rows[0]!.n !== ids.length) throw new ValidationError("interest.unknown");
    }
    await tx.query("DELETE FROM person_interest WHERE membership_id = $1", [actor.membershipId]);
    for (const id of ids) await tx.query("INSERT INTO person_interest (organisation_id, membership_id, interest_id) VALUES ($1, $2, $3)", [actor.organisationId, actor.membershipId, id]);
  });
}

/** Ensures the organisation's taxonomy exists before the first read or write that depends on it. */
export async function prepareTaxonomy(actor: Actor): Promise<void> {
  await withOrg(actor.organisationId, (tx: Tx) => ensureTaxonomy(tx, actor.organisationId));
}

export type { VisibilityField, VisibilityLevel };
