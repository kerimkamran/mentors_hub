import { withGlobal } from "@/lib/db";
import { authorize, type Actor } from "@/lib/permissions";
import { DENSITIES, THEMES, type Density, type Theme } from "@/lib/theme-tokens";

export interface Appearance {
  theme: Theme;
  density: Density;
}
export const DEFAULT_APPEARANCE: Appearance = { theme: "system", density: "comfortable" };

/** A person's stored theme and density. It lives on their identity, so it follows them to another device (AC-ADM-23.5). */
export async function loadAppearance(identityId: string): Promise<Appearance> {
  const r = await withGlobal((tx) => tx.query<{ theme: Theme; density: Density }>("SELECT theme, density FROM identity WHERE id = $1", [identityId]));
  const row = r.rows[0];
  return row ? { theme: row.theme, density: row.density } : DEFAULT_APPEARANCE;
}

export class InvalidAppearance extends Error {}

/** Saves MY preference (only the fields given). Reads and writes only the actor's own identity row. */
export async function saveAppearance(actor: Actor, input: { theme?: unknown; density?: unknown }): Promise<Appearance> {
  authorize(actor, "appearance.edit.own", { ownerMembershipId: actor.membershipId });
  if (input.theme !== undefined && !(THEMES as readonly unknown[]).includes(input.theme)) throw new InvalidAppearance("theme");
  if (input.density !== undefined && !(DENSITIES as readonly unknown[]).includes(input.density)) throw new InvalidAppearance("density");
  await withGlobal((tx) =>
    tx.query("UPDATE identity SET theme = COALESCE($2, theme), density = COALESCE($3, density) WHERE id = $1", [
      actor.identityId,
      input.theme ?? null,
      input.density ?? null,
    ]),
  );
  return loadAppearance(actor.identityId);
}
