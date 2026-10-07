import { randomToken } from "../crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "../i18n";
import type { Actor } from "../permissions";
import { hasAcceptedNotice, resolveSession, totpRequired } from "./core";

export const SESSION_COOKIE = "mh_session";
export const BROWSER_COOKIE = "mh_browser";
export const LANG_COOKIE = "mh_lang";

const base = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

/** Browser secret that binds a sign-in code to the requesting browser (INV-5.3). Call from server actions only. */
export async function ensureBrowserId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(BROWSER_COOKIE)?.value;
  if (existing && existing.length >= 32) return existing;
  const id = randomToken();
  jar.set(BROWSER_COOKIE, id, { ...base, maxAge: 60 * 60 * 24 * 365 });
  return id;
}

export async function readBrowserId(): Promise<string | null> {
  return (await cookies()).get(BROWSER_COOKIE)?.value ?? null;
}

export async function setSessionCookie(token: string, maxAgeSeconds: number) {
  (await cookies()).set(SESSION_COOKIE, token, { ...base, maxAge: maxAgeSeconds });
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in person for this request, or null. Cached per request. */
export const getActor = cache(async (): Promise<Actor | null> => resolveSession(await readSessionToken()));

export async function getLocale(): Promise<Locale> {
  const actor = await getActor();
  if (actor) return actor.locale;
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(c) ? c : "en";
}

export interface RequireOpts {
  /** Require the privacy notice to be accepted (default true). */
  consent?: boolean;
  /** Require TOTP for administrators (default true). */
  totp?: boolean;
}

/** Guard for every signed-in page and action: redirects to sign-in, TOTP or consent as needed. */
export async function requireActor(opts: RequireOpts = {}): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (opts.totp !== false && totpRequired(actor) && !actor.totpVerified) redirect("/auth/totp");
  if (opts.consent !== false && !(await hasAcceptedNotice(actor))) redirect("/consent");
  return actor;
}
