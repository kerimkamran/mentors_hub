import { exportDirectory } from "@/domain/people/directory-export";
import { parseFilters } from "@/domain/people/directory";
import { fileResponse, notFoundResponse, routeActor } from "@/lib/http-guards";
import { NotFoundError } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Directory CSV export (AC-ADM-22.3). POST: it writes the export log. Allowlisted columns, neutralised cells, filters logged. */
export async function POST(req: Request) {
  const actor = await routeActor(req, { requirePost: true });
  if (!actor) return notFoundResponse();
  const form = await req.formData();
  const filters = parseFilters((n) => {
    const v = form.get(n);
    return typeof v === "string" ? v : null;
  });
  try {
    const f = await exportDirectory(actor, filters);
    return fileResponse(f.csv, f.filename, "text/csv; charset=utf-8");
  } catch (e) {
    if (e instanceof NotFoundError) return notFoundResponse();
    throw e;
  }
}
