"use server";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/http";
import { authorize } from "@/lib/permissions";
import { withGlobal } from "@/lib/db";
import { isLocale } from "@/lib/i18n";

export async function saveSettings(formData: FormData) {
  const actor = await requireActor();
  authorize(actor, "profile.edit.own", { ownerMembershipId: actor.membershipId });
  const locale = formData.get("locale");
  const tz = String(formData.get("time_zone") ?? "").trim();
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    redirect("/settings");
  }
  if (!isLocale(locale)) redirect("/settings");
  await withGlobal((tx) => tx.query("UPDATE identity SET locale = $2, time_zone = $3 WHERE id = $1", [actor.identityId, locale, tz]));
  redirect("/settings");
}
