/**
 * Plain-language impact of a settings change (rule 7, A6): message keys + counts, never values as text.
 * Counts come from the database; nothing here writes.
 */
import type { Tx } from "../../lib/db";
import type { Change } from "./commands";
import type { ImpactLine, SettingsScope } from "./types";

export async function impactLines(tx: Tx, scope: SettingsScope, changes: Change[], status?: "draft" | "active" | "closed"): Promise<ImpactLine[]> {
  const out: ImpactLine[] = [];
  for (const c of changes) {
    out.push({ key: "settings.impact.changed", params: { count: c.rows.length, group: c.group } });
    switch (c.group) {
      case "cadence_capacity": {
        if (c.rows.some((r) => r.path === "cadenceDays")) out.push({ key: "settings.impact.cadence", params: { days: Number(c.after.cadenceDays) } });
        if (scope.type === "programme" && c.rows.some((r) => r.path === "capacityMax")) {
          const r = await tx.query<{ n: number }>(
            `SELECT count(*)::int AS n FROM participation p JOIN cohort k ON k.id = p.cohort_id
             WHERE k.programme_id = $1 AND p.kind = 'mentor' AND p.status <> 'withdrawn' AND p.capacity > $2`,
            [scope.id, Number(c.after.capacityMax)],
          );
          if (r.rows[0]!.n > 0) out.push({ key: "settings.impact.capacity_over", params: { count: r.rows[0]!.n } });
        }
        break;
      }
      case "matching":
        out.push({ key: "settings.impact.matching" });
        out.push({ key: "settings.impact.whatif_pending" });
        break;
      case "timings": out.push({ key: "settings.impact.timings" }); break;
      case "flags": out.push({ key: "settings.impact.flags" }); break;
      case "security": out.push({ key: "settings.impact.security" }); break;
      case "session_timing": out.push({ key: "settings.impact.session_timing" }); break;
      case "brand": out.push({ key: "settings.impact.brand" }); break;
      case "localisation": out.push({ key: "settings.impact.localisation" }); break;
      case "admin_ops": out.push({ key: "settings.impact.admin_ops" }); break;
    }
  }
  if (scope.type === "programme") out.push({ key: status === "active" ? "settings.impact.existing_unchanged" : "settings.impact.draft" });
  return out;
}
