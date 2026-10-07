"use server";
import { redirect } from "next/navigation";
import { completeWithCode, requestSignIn } from "@/lib/auth/core";
import { ensureBrowserId, setSessionCookie } from "@/lib/auth/http";

export async function requestLink(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const browserId = await ensureBrowserId();
  const result = await requestSignIn(email, browserId);
  // The same page for every outcome except rate limiting, which depends only on the number of requests (AC-TEN-01.2).
  redirect(result === "limited" ? "/signin/sent?limited=1" : "/signin/sent");
}

export async function submitCode(formData: FormData) {
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const browserId = await ensureBrowserId();
  const done = await completeWithCode(code, browserId);
  if (!done) redirect("/signin/sent?bad=1");
  await setSessionCookie(done.sessionToken, done.maxAgeSeconds);
  redirect("/");
}
