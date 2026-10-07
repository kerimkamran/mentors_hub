import type { Canonical } from "./columns";

export type Cells = Partial<Record<Canonical, string>>;

/** One data row of the file after header mapping and cell cleaning. `rowNumber` is the spreadsheet row (header = 1). */
export interface ParsedRow {
  rowNumber: number;
  cells: Cells;
}

export interface NormalisedRow {
  employeeId: string;
  email: string;
  displayName: string;
  department: string | null;
  jobTitle: string | null;
  hireDate: string | null;
  grade: string | null;
  gradeOrder: number | null;
  managerEmployeeId: string | null;
  status: "active" | "inactive";
}

/** Reason codes for a rejected row. The user-facing text lives in src/messages/people (people.import.reason.<code>). */
export const REJECT_REASONS = [
  "missing_employee_id",
  "invalid_employee_id",
  "missing_email",
  "invalid_email",
  "email_domain_not_allowed",
  "missing_name",
  "field_too_long",
  "invalid_hire_date",
  "invalid_grade_order",
  "invalid_manager_id",
  "invalid_status",
  "duplicate_employee_id",
  "duplicate_email",
  "employee_id_email_mismatch",
  "email_in_use",
  "manager_missing",
  "manager_rejected",
  "manager_cycle",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type Outcome = "create" | "update" | "unchanged" | "deactivate" | "reject";

/** The person as currently stored (hr_record + identity + profile + grade + manager), used for diffing. */
export interface ExistingPerson {
  membershipId: string;
  employeeId: string;
  email: string;
  displayName: string | null;
  department: string | null;
  jobTitle: string | null;
  hireDate: string | null;
  gradeName: string | null;
  managerEmployeeId: string | null;
  hrStatus: "active" | "inactive";
  membershipStatus: "active" | "inactive" | "invited";
}

/** A membership of the organisation that has an identity with a file email but no HR record yet (e.g. a PM invitee). */
export interface ExistingByEmail {
  membershipId: string;
  employeeId: string | null;
  membershipStatus: "active" | "inactive" | "invited";
}

export interface LadderEntry {
  name: string;
  sourceOrder: number | null;
  orderIndex: number;
  bucket: number;
}

export interface RowResult {
  rowNumber: number | null;
  employeeId: string | null;
  displayName: string | null;
  outcome: Outcome;
  reason?: RejectReason;
  /** Set for create/update/unchanged. */
  row?: NormalisedRow;
  /** Existing membership this row updates, or deactivates. */
  membershipId?: string;
  /** Raw cells as stored in import_row.raw (create/update/unchanged/reject) or {employee_id, display_name} (deactivate). */
  raw: Record<string, string>;
}

export interface PlanCounts {
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  rejected: number;
  keptAdmins: number;
}

export interface Plan {
  results: RowResult[];
  counts: PlanCounts;
  ladder: LadderEntry[];
  ladderAdded: number;
  ladderChanged: number;
  /** Set when a full-sync run would deactivate everybody because no row of the file is usable. */
  blocked?: "empty_full_sync";
}
