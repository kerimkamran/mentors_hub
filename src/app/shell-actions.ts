"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { withGlobal } from "@/lib/db";
import { clearSessionCookie, getActor, LANG_COOKIE, readSessionToken } from "@/lib/auth/http";
import { revokeSession } from "@/lib/auth/core";
import { isLocale } from "@/lib/i18n";

export async function setLanguage(formData: FormData) {
  const lang = formData.get("lang");
  if (!isLocale(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const actor = await getActor();
  if (actor) await withGlobal((tx) => tx.query("UPDATE identity SET locale = $2 WHERE id = $1", [actor.identityId, lang]));
  redirect("/");
}

export async function signOut() {
  const token = await readSessionToken();
  if (token) await revokeSession(token);
  await clearSessionCookie();
  redirect("/signin");
}
