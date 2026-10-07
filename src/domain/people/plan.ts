/**
 * The import plan: a PURE function from (file rows, current database state) to what an import would do.
 * Nothing here touches the database, so the dry-run preview (FR-IMP-003) and the confirmed run use the same code.
 *
 * Rules: field validation (./validate), duplicates inside the file, conflicts with stored people, manager chains with
 * missing managers and cycles reported as row errors (FR-IMP-005), idempotent classification (FR-IMP-004: an identical
 * row is "unchanged"), full-sync deactivation of absent people (FR-IMP-011), grade ladder (FR-IMP-006).
 */
import type { Canonical } from "./columns";
import { computeLadder } from "./grades";
import type { ExistingByEmail, ExistingPerson, LadderEntry, NormalisedRow, ParsedRow, Plan, PlanCounts, RejectReason, RowResult } from "./types";
import { validateRow } from "./validate";

export interface PlanInput {
  rows: ParsedRow[];
  presentColumns: ReadonlySet<Canonical>;
  domains: ReadonlySet<string>;
  /** Every HR record of the organisation. */
  existing: ExistingPerson[];
  /** Memberships (any status) whose identity email appears in the file, keyed by lower-case email. */
  byEmail: ReadonlyMap<string, ExistingByEmail>;
  ladder: LadderEntry[];
  fullSync: boolean;
  /** People an import must never deactivate (organisation admins, the person running the import). */
  protectedMembershipIds: ReadonlySet<string>;
  gradeBuckets: number;
  maxCell?: number;
}

export function planImport(input: PlanInput): Plan {
  const { rows, presentColumns, existing, byEmail } = input;
  const existingById = new Map(existing.map((e) => [e.employeeId, e]));
  const reasons = new Map<ParsedRow, RejectReason>();
  const valid = new Map<ParsedRow, NormalisedRow>();

  // 1. Field validation.
  for (const r of rows) {
    const v = validateRow(r.cells, input.domains, input.maxCell);
    if (v.ok) valid.set(r, v.row);
    else reasons.set(r, v.reason);
  }
  const reject = (r: ParsedRow, reason: RejectReason) => {
    valid.delete(r);
    reasons.set(r, reason);
  };

  // 2. Duplicates inside the file: every occurrence is rejected (we cannot know which one is right).
  const countBy = (key: (n: NormalisedRow) => string) => {
    const m = new Map<string, number>();
    for (const n of valid.values()) m.set(key(n), (m.get(key(n)) ?? 0) + 1);
    return m;
  };
  const idCounts = countBy((n) => n.employeeId);
  const emailCounts = countBy((n) => n.email);
  for (const [r, n] of [...valid]) {
    if (idCounts.get(n.employeeId)! > 1) reject(r, "duplicate_employee_id");
    else if (emailCounts.get(n.email)! > 1) reject(r, "duplicate_email");
  }

  // 3. Conflicts with stored people: the same employee id with another email, or the email already held by another employee.
  for (const [r, n] of [...valid]) {
    const sameId = existingById.get(n.employeeId);
    if (sameId && sameId.email !== n.email) reject(r, "employee_id_email_mismatch");
    else if (!sameId) {
      const holder = byEmail.get(n.email);
      if (holder?.employeeId && holder.employeeId !== n.employeeId) reject(r, "email_in_use");
    }
  }

  // 4. Manager chains. Iterate to a fixed point: rejecting a row can orphan its reports or break a chain.
  const columnHasManager = presentColumns.has("manager_employee_id");
  const rejectedIds = () => new Set(rows.filter((r) => reasons.has(r)).map((r) => (r.cells.employee_id ?? "").trim()));
  for (let changed = true; changed; ) {
    changed = false;
    const validIds = new Map([...valid].map(([r, n]) => [n.employeeId, { r, n }]));
    const rejected = rejectedIds();
    for (const { r, n } of validIds.values()) {
      const m = columnHasManager ? n.managerEmployeeId : null;
      if (m && !validIds.has(m) && !existingById.has(m)) {
        reject(r, rejected.has(m) ? "manager_rejected" : "manager_missing");
        changed = true;
      }
    }
    if (changed) continue;
    const edge = (id: string): string | null => {
      const v = validIds.get(id);
      if (v) return columnHasManager ? v.n.managerEmployeeId : (existingById.get(id)?.managerEmployeeId ?? null);
      return existingById.get(id)?.managerEmployeeId ?? null;
    };
    // Each person has at most one manager, so cycle membership is found by walking each chain once.
    const state = new Map<string, 1 | 2>();
    const onCycle = new Set<string>();
    for (const start of validIds.keys()) {
      if (state.has(start)) continue;
      const path: string[] = [];
      let cur: string | null = start;
      while (cur && !state.has(cur)) {
        state.set(cur, 1);
        path.push(cur);
        cur = edge(cur);
      }
      if (cur && state.get(cur) === 1) for (let i = path.indexOf(cur); i < path.length; i++) onCycle.add(path[i]!);
      for (const p of path) state.set(p, 2);
    }
    for (const id of onCycle) {
      const v = validIds.get(id);
      if (v) { reject(v.r, "manager_cycle"); changed = true; }
    }
  }

  // 5. Classification of the valid rows.
  const results: RowResult[] = [];
  const counts: PlanCounts = { created: 0, updated: 0, unchanged: 0, deactivated: 0, rejected: 0, keptAdmins: 0 };
  const seenIds = new Set<string>();
  for (const r of rows) {
    const id = (r.cells.employee_id ?? "").trim();
    if (id) seenIds.add(id);
    const raw = rawOf(r);
    const reason = reasons.get(r);
    if (reason) {
      counts.rejected++;
      results.push({ rowNumber: r.rowNumber, employeeId: id || null, displayName: (r.cells.display_name ?? "").trim() || null, outcome: "reject", reason, raw });
      continue;
    }
    const n = valid.get(r)!;
    const stored = existingById.get(n.employeeId);
    const linked = stored ? undefined : byEmail.get(n.email);
    let outcome: "create" | "update" | "unchanged";
    if (stored) outcome = differs(n, stored, presentColumns) ? "update" : "unchanged";
    else if (linked) outcome = "update"; // an invited person becomes an HR-managed person
    else outcome = "create";
    if (outcome === "create") counts.created++;
    else if (outcome === "update") counts.updated++;
    else counts.unchanged++;
    results.push({ rowNumber: r.rowNumber, employeeId: n.employeeId, displayName: n.displayName, outcome, row: n, membershipId: stored?.membershipId ?? linked?.membershipId, raw });
  }

  // 6. Full sync: people with an active HR record who are absent from the file are deactivated, never deleted.
  //    "Present" means the employee id appears in the file at all, even on a row that was rejected.
  let blocked: Plan["blocked"];
  if (input.fullSync) {
    if (counts.created + counts.updated + counts.unchanged === 0) blocked = "empty_full_sync";
    else
      for (const e of existing) {
        if (e.hrStatus !== "active" || seenIds.has(e.employeeId)) continue;
        if (input.protectedMembershipIds.has(e.membershipId)) { counts.keptAdmins++; continue; }
        counts.deactivated++;
        results.push({ rowNumber: null, employeeId: e.employeeId, displayName: e.displayName, outcome: "deactivate", membershipId: e.membershipId, raw: { employee_id: e.employeeId, display_name: e.displayName ?? "" } });
      }
  }

  // 7. Grade ladder from the valid rows.
  const grades = [...valid.values()].filter((n) => n.grade).map((n) => ({ name: n.grade!, sourceOrder: n.gradeOrder }));
  const { ladder, added, changed } = computeLadder(input.ladder, grades, input.gradeBuckets);
  return { results, counts, ladder, ladderAdded: added, ladderChanged: changed, blocked };
}

function rawOf(r: ParsedRow): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.cells)) if (v !== undefined) o[k] = v;
  return o;
}

/** Only the columns present in the file are compared (an absent column leaves the stored value alone). */
function differs(n: NormalisedRow, s: ExistingPerson, present: ReadonlySet<Canonical>): boolean {
  if (n.displayName !== s.displayName) return true;
  if (present.has("department") && n.department !== s.department) return true;
  if (present.has("job_title") && n.jobTitle !== s.jobTitle) return true;
  if (present.has("hire_date") && n.hireDate !== s.hireDate) return true;
  if (present.has("grade") && n.grade !== s.gradeName) return true;
  if (present.has("manager_employee_id") && n.managerEmployeeId !== s.managerEmployeeId) return true;
  if (n.status !== s.hrStatus) return true;
  const wanted = n.status === "active" ? "active" : "inactive";
  return s.membershipStatus !== wanted;
}
