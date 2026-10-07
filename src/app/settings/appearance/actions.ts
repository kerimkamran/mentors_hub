"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/http";
import { InvalidAppearance, saveAppearance } from "@/domain/appearance";
import { NotFoundError } from "@/lib/permissions";

/** Called by the dense/comfortable toggle in tables (client component). */
export async function saveDensity(density: string): Promise<void> {
  const actor = await requireActor();
  try {
    await saveAppearance(actor, { density });
  } catch (e) {
    if (e instanceof InvalidAppearance || e instanceof NotFoundError) return;
    throw e;
  }
}

/** Header theme switch and the appearance page: theme and/or density. */
export async function saveAppearanceForm(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const theme = formData.get("theme");
  const density = formData.get("density");
  try {
    await saveAppearance(actor, { theme: theme === null ? undefined : theme, density: density === null ? undefined : density });
  } catch (e) {
    if (!(e instanceof InvalidAppearance)) throw e;
  }
  revalidatePath("/", "layout");
  const back = formData.get("back");
  redirect(typeof back === "string" && back.startsWith("/") && !back.startsWith("//") ? back : "/settings/appearance");
}
