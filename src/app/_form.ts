import { redirect } from "next/navigation";
import { ValidationError } from "@/domain/profiles/errors";
import { NotFoundError } from "@/lib/permissions";

/** Turns a domain failure into a redirect: validation codes go back to the form, denials look like a missing page (INV-4.3). */
export function failTo(path: string, e: unknown): never {
  if (e instanceof ValidationError) redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(e.code)}`);
  if (e instanceof NotFoundError) redirect("/not-found");
  throw e;
}

/** An error code from the query string is shown only if it names a known message; anything else becomes the generic text. */
export function knownErrKey(code: string | undefined, has: (key: string) => boolean): string | null {
  if (!code) return null;
  const key = `prf.err.${code}`;
  return has(key) ? key : "prf.err.generic";
}
