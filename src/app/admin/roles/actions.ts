"use server";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/http";
import { grantRole, revokeRole, StepUpRequired } from "@/domain/roles";
import { NotFoundError, type Role, type ScopeType } from "@/lib/permissions";

const ROLES: Role[] = ["org_admin", "pm", "assessor", "content_manager", "safeguarding"];

export async function grant(formData: FormData) {
  const actor = await requireActor();
  const role = String(formData.get("role")) as Role;
  const scopeType = String(formData.get("scope_type") ?? "org") as ScopeType;
  const scopeId = String(formData.get("scope_id") ?? "") || null;
  if (!ROLES.includes(role)) redirect("/admin/roles");
  try {
    await grantRole(actor, { membershipId: String(formData.get("membership_id")), role, scopeType, scopeId: scopeType === "org" ? null : scopeId });
  } catch (e) {
    if (e instanceof StepUpRequired) redirect("/auth/totp");
    if (e instanceof NotFoundError) redirect("/not-found");
    throw e;
  }
  redirect("/admin/roles");
}

export async function revoke(formData: FormData) {
  const actor = await requireActor();
  try {
    await revokeRole(actor, String(formData.get("id")));
  } catch (e) {
    if (e instanceof StepUpRequired) redirect("/auth/totp");
    if (e instanceof NotFoundError) redirect("/not-found");
    throw e;
  }
  redirect("/admin/roles");
}
