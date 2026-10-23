"use server";
import { redirect } from "next/navigation";
import { setSessionCookie } from "@/lib/auth/http";
import { redeemInvite } from "@/lib/auth/invite";

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const done = token ? await redeemInvite(token) : null;
  if (!done) redirect(`/auth/invite?t=${encodeURIComponent(token)}`);
  await setSessionCookie(done.sessionToken, done.maxAgeSeconds);
  redirect("/");
}
