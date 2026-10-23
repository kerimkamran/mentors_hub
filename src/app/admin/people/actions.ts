"use server";
import { notFound, redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/http";
import { deactivatePerson } from "@/domain/people/commands";
import { can, NotFoundError } from "@/lib/permissions";
import { env } from "@/lib/env";
import { InviteError, invitePerson } from "@/lib/auth/invite";
import { t } from "@/lib/i18n";

export interface InviteState {
  link?: string;
  email?: string;
  error?: string;
}

/** Creates (or re-issues) a single-use invite link. The link is returned to the page once and never stored in plain text. */
export async function invite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const actor = await requireActor();
  if (!can(actor, "people.invite")) notFound();
  const email = String(formData.get("email") ?? "");
  try {
    const r = await invitePerson(actor, { email, name: String(formData.get("name") ?? "") });
    const base = env().APP_BASE_URL.replace(/\/+$/, "");
    return { link: `${base}/auth/invite?t=${r.token}`, email: email.trim().toLowerCase() };
  } catch (e) {
    if (e instanceof InviteError) return { error: t(actor.locale, `people.invite.error.${e.reason}`) };
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deactivate(formData: FormData) {
  const actor = await requireActor();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) notFound();
  try {
    await deactivatePerson(actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  redirect(`/admin/people/${id}`);
}
