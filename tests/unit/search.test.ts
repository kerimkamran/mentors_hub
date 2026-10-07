import { describe, expect, it } from "vitest";
import { normalise } from "../../src/lib/search";

describe("search normalisation (unit)", () => {
  it.each([
    ["Məmmədov", "memmedov"],
    ["ŞAHİN", "sahin"],
    ["Ğ", "g"],
    ["Ёлкин", "елкин"],
    ["Hüseyn Ömər Çələbi", "huseyn omer celebi"],
  ])("%s → %s", (input, expected) => {
    expect(normalise(input)).toBe(expected);
  });

  it("is idempotent and treats composed and decomposed forms alike", () => {
    expect(normalise(normalise("Çərkəz"))).toBe(normalise("Çərkəz"));
    expect(normalise("C\u0327")).toBe(normalise("Ç"));
  });
});
