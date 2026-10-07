import { describe, expect, it } from "vitest";
import { CATALOGUES, LOCALES, t } from "../../src/lib/i18n";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("AC-TEN-02.4 · translation completeness gate", () => {
  for (const cat of CATALOGUES) {
    it("every key exists in en, az and ru, is non-empty, and uses the same placeholders", () => {
      const keys = Object.keys(cat.en);
      for (const l of LOCALES) {
        expect(Object.keys(cat[l]).sort(), `${l} keys`).toEqual([...keys].sort());
        for (const k of keys) expect((cat[l] as Record<string, string>)[k]!.trim().length, `${l}:${k}`).toBeGreaterThan(0);
      }
      for (const k of keys)
        for (const l of ["az", "ru"] as const)
          expect(placeholders((cat[l] as Record<string, string>)[k]!), `placeholders ${l}:${k}`).toBe(placeholders((cat.en as Record<string, string>)[k]!));
    });
  }
  it("renders parameters and throws on an unknown key instead of showing a raw key", () => {
    expect(t("az", "home.welcome", { name: "Leyla" })).toContain("Leyla");
    expect(() => t("en", "no.such.key")).toThrow(/missing translation key/);
  });
});
