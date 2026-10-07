import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

describe("T-INV1-05 · the raw database pool is imported only by the database-client module", () => {
  it("no file under src/ or worker/ imports 'pg' except src/lib/db.ts", () => {
    const offenders = [...files("src"), ...files("worker")]
      .filter((f) => f !== join("src", "lib", "db.ts"))
      .filter((f) => /from\s+["']pg["']|require\(["']pg["']\)/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("src/lib/db.ts does not export the pool", () => {
    expect(readFileSync("src/lib/db.ts", "utf8")).not.toMatch(/export\s+(const|let)\s+pool|export\s*\{[^}]*\bpool\b/);
  });
});
