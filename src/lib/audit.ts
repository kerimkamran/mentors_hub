import type { Tx } from "./db";

/** Statuses and the shape of codes mirror the audit_log CHECK constraints (INV-3: no free text). */
export type AuditStatus = "ok" | "denied" | "failed";
const CODE = /^[a-z][a-z0-9_.]{1,63}$/;

export interface AuditEntry {
  organisationId: string;
  actorId: string | null; // membership id
  action: string; // a code like 'role.grant', never a sentence
  objectType?: string;
  objectId?: string | null;
  status?: AuditStatus;
}

export async function audit(tx: Tx, e: AuditEntry): Promise<void> {
  if (!CODE.test(e.action)) throw new Error(`audit action must be a code: ${e.action}`);
  await tx.query(
    `INSERT INTO audit_log (organisation_id, actor_id, action, object_type, object_id, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [e.organisationId, e.actorId, e.action, e.objectType ?? null, e.objectId ?? null, e.status ?? "ok"],
  );
}
