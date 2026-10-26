"use server";
import { redirect } from "next/navigation";
import { ensureBrowserId, setSessionCookie } from "@/lib/auth/http";
import { signInWithPassword } from "@/lib/auth/password-signin";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const browserId = await ensureBrowserId();
  const done = await signInWithPassword(email, password, browserId);
  // One message for every failure; rate limiting depends only on the number of attempts.
  if (done === "limited") redirect("/signin?e=limited");
  if (!done) redirect("/signin?e=bad");
  await setSessionCookie(done.sessionToken, done.maxAgeSeconds);
  redirect("/");
}
