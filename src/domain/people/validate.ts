import type { Cells } from "./types";
import type { NormalisedRow, RejectReason } from "./types";

const EMAIL = /^[^\s@'=+][^\s@]*@[^\s@]+\.[^\s@]+$/;
const EMPLOYEE_ID = /^[\p{L}\p{N}][\p{L}\p{N}._\-/]{0,63}$/u;

const ACTIVE = new Set(["active", "1", "yes", "y", "true", "working", "employed", "aktiv", "aktivdir", "işləyir", "активен", "активный", "действующий", "работает", "да"]);
const INACTIVE = new Set(["inactive", "0", "no", "n", "false", "terminated", "left", "resigned", "deaktiv", "passiv", "işdən çıxıb", "неактивен", "неактивный", "не активен", "уволен", "нет"]);

export function parseStatus(raw: string): "active" | "inactive" | null {
  const v = raw.trim().toLowerCase();
  if (v === "") return "active"; // a person listed in the HR file is employed unless the file says otherwise
  if (ACTIVE.has(v)) return "active";
  if (INACTIVE.has(v)) return "inactive";
  return null;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
function validYmd(y: number, m: number, d: number): boolean {
  if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  const dim = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
  return d <= dim;
}

/** Accepts yyyy-mm-dd (also yyyy/mm/dd) and dd.mm.yyyy / dd/mm/yyyy (day first, as used in Azerbaijan and Russia). Returns ISO or null. */
export function parseHireDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/.exec(s);
  if (match) [y, m, d] = [+match[1]!, +match[2]!, +match[3]!];
  else if ((match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s))) [d, m, y] = [+match[1]!, +match[2]!, +match[3]!];
  else return null;
  if (!validYmd(y, m, d)) return null;
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

export type Validated = { ok: true; row: NormalisedRow } | { ok: false; reason: RejectReason };

/** Field-level validation of one row. `domains` are the email domains registered to the organisation (organisation_domain). */
export function validateRow(cells: Cells, domains: ReadonlySet<string>, maxCell = 500): Validated {
  const get = (k: keyof Cells) => (cells[k] ?? "").trim();
  const fail = (reason: RejectReason): Validated => ({ ok: false, reason });
  for (const v of Object.values(cells)) if ((v ?? "").length > maxCell) return fail("field_too_long");

  const employeeId = get("employee_id");
  if (employeeId === "") return fail("missing_employee_id");
  if (!EMPLOYEE_ID.test(employeeId)) return fail("invalid_employee_id");

  const email = get("email").toLowerCase();
  if (email === "") return fail("missing_email");
  if (email.length > 254 || !EMAIL.test(email)) return fail("invalid_email");
  if (!domains.has(email.slice(email.lastIndexOf("@") + 1))) return fail("email_domain_not_allowed");

  const displayName = get("display_name");
  if (displayName === "") return fail("missing_name");
  if (displayName.length > 200) return fail("field_too_long");
  const department = get("department");
  const jobTitle = get("job_title");
  if (department.length > 200 || jobTitle.length > 200) return fail("field_too_long");

  let hireDate: string | null = null;
  if (get("hire_date") !== "") {
    hireDate = parseHireDate(get("hire_date"));
    if (!hireDate) return fail("invalid_hire_date");
  }

  const grade = get("grade");
  if (grade.length > 100) return fail("field_too_long");
  let gradeOrder: number | null = null;
  if (get("grade_order") !== "") {
    const n = Number(get("grade_order").replace(",", "."));
    if (!Number.isFinite(n) || Math.abs(n) > 1e6) return fail("invalid_grade_order");
    gradeOrder = n;
  }

  const managerRaw = get("manager_employee_id");
  if (managerRaw !== "" && !EMPLOYEE_ID.test(managerRaw)) return fail("invalid_manager_id");

  const status = parseStatus(get("status"));
  if (!status) return fail("invalid_status");

  return {
    ok: true,
    row: {
      employeeId,
      email,
      displayName,
      department: department || null,
      jobTitle: jobTitle || null,
      hireDate,
      grade: grade || null,
      gradeOrder,
      managerEmployeeId: managerRaw || null,
      status,
    },
  };
}
