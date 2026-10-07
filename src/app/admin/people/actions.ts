"use server";
import { notFound, redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/http";
import { deactivatePerson } from "@/domain/people/commands";
import { NotFoundError } from "@/lib/permissions";

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
