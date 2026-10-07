"use server";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/http";
import { ValidationError, removeLanguage, removePersonTopic, saveProfileDraft, saveProfileText, setExpertiseAreas, setFieldVisibility, setInterests, setLanguage, setPersonTopic } from "@/domain/profiles/commands";
import { failTo } from "../_form";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function changeVisibility(formData: FormData) {
  const actor = await requireActor();
  try {
    await setFieldVisibility(actor, str(formData, "field"), str(formData, "level"));
  } catch (e) {
    failTo("/profile", e);
  }
  redirect("/profile?saved=1");
}

/** Autosave of the free-text part; called from the client component, never from a page render. */
export async function autosaveProfileText(payload: { bio: string; headline: string }): Promise<{ ok: boolean; retry: boolean }> {
  const actor = await requireActor();
  try {
    await saveProfileDraft(actor, { bio: String(payload.bio ?? ""), headline: String(payload.headline ?? "") });
    return { ok: true, retry: false };
  } catch (e) {
    return { ok: false, retry: !(e instanceof ValidationError) };
  }
}

export async function saveText(formData: FormData) {
  const actor = await requireActor();
  try {
    await saveProfileText(actor, { bio: str(formData, "bio"), headline: str(formData, "headline") });
  } catch (e) {
    failTo("/profile", e);
  }
  redirect("/profile?saved=1");
}

export async function addTopic(formData: FormData) {
  const actor = await requireActor();
  const role = str(formData, "role") === "seeks" ? "seeks" : "offers";
  try {
    await setPersonTopic(actor, { topicId: str(formData, "topic_id"), role, depth: str(formData, "depth") || null });
  } catch (e) {
    failTo(`/profile?role=${role}&tq=${encodeURIComponent(str(formData, "tq"))}`, e);
  }
  redirect(`/profile?saved=1#${role}`);
}

export async function removeTopic(formData: FormData) {
  const actor = await requireActor();
  const role = str(formData, "role") === "seeks" ? "seeks" : "offers";
  try {
    await removePersonTopic(actor, { topicId: str(formData, "topic_id"), role });
  } catch (e) {
    failTo("/profile", e);
  }
  redirect(`/profile#${role}`);
}

export async function saveAreas(formData: FormData) {
  const actor = await requireActor();
  try {
    await setExpertiseAreas(actor, formData.getAll("area").map(String));
  } catch (e) {
    failTo("/profile", e);
  }
  redirect("/profile?saved=1#areas");
}

export async function saveLanguage(formData: FormData) {
  const actor = await requireActor();
  try {
    await setLanguage(actor, { language: str(formData, "language"), level: str(formData, "level") });
  } catch (e) {
    failTo("/profile", e);
  }
  redirect("/profile?saved=1#languages");
}

export async function deleteLanguage(formData: FormData) {
  const actor = await requireActor();
  try {
    await removeLanguage(actor, str(formData, "language"));
  } catch (e) {
    failTo("/profile", e);
  }
  redirect("/profile#languages");
}

export async function saveInterests(formData: FormData) {
  const actor = await requireActor();
  try {
    await setInterests(actor, formData.getAll("interest").map(String));
  } catch (e) {
    failTo("/profile", e);
  }
  redirect("/profile?saved=1#interests");
}
