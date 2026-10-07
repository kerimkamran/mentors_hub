"use server";
import { redirect } from "next/navigation";
import { recordConsent, revokeSession } from "@/lib/auth/core";
import { clearSessionCookie, readSessionToken, requireActor } from "@/lib/auth/http";
import { AI_CONSENT_VERSION, PRIVACY_NOTICE_VERSION } from "@/lib/constants";

export async function accept(formData: FormData) {
  const actor = await requireActor({ consent: false });
  await recordConsent(actor, "privacy_notice", PRIVACY_NOTICE_VERSION);
  if (formData.get("ai") === "on") await recordConsent(actor, "ai_assistance", AI_CONSENT_VERSION); // optional (INV-6.2)
  redirect("/");
}

export async function decline() {
  const token = await readSessionToken();
  if (token) await revokeSession(token);
  await clearSessionCookie();
  redirect("/signin");
}
