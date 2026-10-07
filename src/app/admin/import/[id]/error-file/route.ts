import { exportErrorFile } from "@/domain/people/commands";
import { fileResponse, notFoundResponse, routeActor } from "@/lib/http-guards";
import { NotFoundError } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Error file download (AC-ADM-07.2). POST, because it is logged by run id like every export. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await routeActor(req, { requirePost: true });
  if (!actor) return notFoundResponse();
  try {
    const f = await exportErrorFile(actor, (await ctx.params).id);
    return fileResponse(f.csv, f.filename, "text/csv; charset=utf-8");
  } catch (e) {
    if (e instanceof NotFoundError) return notFoundResponse();
    throw e;
  }
}
