"use server";
import { redirect } from "next/navigation";
import { setSessionCookie } from "@/lib/auth/http";
import { PasswordError, redeemInvite } from "@/lib/auth/invite";

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const back = (e: string) => redirect(`/auth/invite?t=${encodeURIComponent(token)}&e=${e}`);
  if (password !== String(formData.get("confirm") ?? "")) back("mismatch");
  let done;
  try {
    done = token ? await redeemInvite(token, password) : null;
  } catch (e) {
    if (e instanceof PasswordError) back(e.reason);
    throw e;
  }
  if (!done) redirect(`/auth/invite?t=${encodeURIComponent(token)}`);
  await setSessionCookie(done.sessionToken, done.maxAgeSeconds);
  redirect("/");
}
