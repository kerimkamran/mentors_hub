import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const files = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? files(p) : [p]; });

describe("INV-5.5 / T-INV5-05 · no state-changing GET anywhere", () => {
  it("route handlers that export GET import no command/action module", () => {
    const routes = files("src/app").filter((f) => /route\.ts$/.test(f));
    for (const f of routes) {
      const text = readFileSync(f, "utf8");
      if (!/export\s+(async\s+)?function\s+GET|export\s+const\s+GET/.test(text)) continue;
      expect(text, `${f} must not import actions/commands`).not.toMatch(/from\s+["'][^"']*(actions|commands)["']/);
      expect(text, `${f} must not contain write SQL`).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b\s/);
    }
  });
  it("page components never call a server action while rendering (they only bind it to a form)", () => {
    for (const f of files("src/app").filter((x) => /page\.tsx$/.test(x))) {
      const text = readFileSync(f, "utf8");
      const imported = [...text.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'][^"']*actions["']/g)].flatMap((m) => m[1]!.split(",").map((s) => s.trim()));
      for (const name of imported) expect(text, `${f} calls ${name}() during render`).not.toMatch(new RegExp(`await\\s+${name}\\(`));
    }
  });
});
