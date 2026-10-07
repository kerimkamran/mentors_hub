"use server";
import { notFound, redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/http";
import { confirmImport, createImportPreview, ImportBlockedError, ImportFileError } from "@/domain/people/commands";
import { importSettings } from "@/domain/people/settings";
import { NotFoundError } from "@/lib/permissions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Upload → dry-run preview. Nothing about people is written (FR-IMP-003). */
export async function uploadImport(formData: FormData) {
  const actor = await requireActor();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/admin/import?e=no_file");
  const { maxFileBytes } = await importSettings(actor.organisationId);
  if (file.size > maxFileBytes) redirect("/admin/import?e=file_too_large");

  const scopeValue = String(formData.get("scope") ?? "org");
  const scope = scopeValue.startsWith("p:") && UUID.test(scopeValue.slice(2)) ? { programmeId: scopeValue.slice(2) }
    : scopeValue.startsWith("c:") && UUID.test(scopeValue.slice(2)) ? { cohortId: scopeValue.slice(2) }
    : null;
  let runId: string;
  try {
    runId = await createImportPreview(actor, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      scope,
      fullSync: formData.get("full_sync") === "on",
      isSynthetic: formData.get("synthetic") === "on",
    });
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    if (e instanceof ImportFileError) redirect(`/admin/import?e=${e.code}${e.detail.length ? `&d=${e.detail.join(",")}` : ""}`);
    if (e instanceof ImportBlockedError) redirect(`/admin/import?e=${e.reason}`);
    throw e;
  }
  redirect(`/admin/import/${runId}`);
}

export async function confirmRun(formData: FormData) {
  const actor = await requireActor();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) notFound();
  let result;
  try {
    result = await confirmImport(actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    if (e instanceof ImportBlockedError) redirect(`/admin/import/${id}?e=${e.reason}`);
    throw e;
  }
  redirect(`/admin/import/${id}${result.status === "stale" ? "?stale=1" : ""}`);
}
