"use server";
import { redirect } from "next/navigation";
import { confirmTotp } from "@/lib/auth/core";
import { readSessionToken, requireActor } from "@/lib/auth/http";

export async function verifyAction(formData: FormData) {
  const actor = await requireActor({ consent: false, totp: false });
  const token = await readSessionToken();
  const ok = token ? await confirmTotp(actor, token, String(formData.get("code") ?? "")) : false;
  redirect(ok ? "/" : "/auth/totp?bad=1");
}
