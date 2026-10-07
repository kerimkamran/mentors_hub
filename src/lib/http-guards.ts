import { hasAcceptedNotice, totpRequired } from "./auth/core";
import { getActor } from "./auth/http";
import type { Actor } from "./permissions";

/**
 * Same-origin check for POST route handlers (file downloads). Server actions get this from Next.js; route handlers do
 * not, so exports that are POST handlers verify the Origin header themselves (the session cookie is also SameSite=Lax).
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

/** The signed-in actor for a route handler, or null (callers answer with the same 404 for every refusal, INV-4.3). */
export async function routeActor(req: Request, opts: { requirePost?: boolean } = {}): Promise<Actor | null> {
  if (opts.requirePost && !sameOrigin(req)) return null;
  const actor = await getActor();
  if (!actor) return null;
  if (totpRequired(actor) && !actor.totpVerified) return null;
  if (!(await hasAcceptedNotice(actor))) return null;
  return actor;
}

export const notFoundResponse = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export function fileResponse(body: string | Uint8Array, filename: string, contentType: string): Response {
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
