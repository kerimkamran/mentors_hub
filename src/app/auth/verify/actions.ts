"use server";
import { redirect } from "next/navigation";
import { completeWithLink } from "@/lib/auth/core";
import { readBrowserId, setSessionCookie } from "@/lib/auth/http";

export async function continueWithLink(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const browserId = await readBrowserId();
  const done = token && browserId ? await completeWithLink(token, browserId) : null;
  if (!done) redirect(`/auth/verify?t=${encodeURIComponent(token)}`);
  await setSessionCookie(done.sessionToken, done.maxAgeSeconds);
  redirect("/");
}
