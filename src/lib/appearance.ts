import { cache } from "react";
import { getActor } from "@/lib/auth/http";
import { DEFAULT_APPEARANCE, loadAppearance, type Appearance } from "@/domain/appearance";

/** Theme and density for this request (per identity; defaults when signed out). Used by the root layout. */
export const getAppearance = cache(async (): Promise<Appearance> => {
  const actor = await getActor();
  return actor ? loadAppearance(actor.identityId) : DEFAULT_APPEARANCE;
});
