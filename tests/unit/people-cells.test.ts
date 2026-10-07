import { describe, expect, it } from "vitest";
import { cleanCell, csvField, needsNeutralising, neutralise, toCsv } from "../../src/domain/people/cells";

describe("FR-IMP-008 · spreadsheet formula-injection protection (cells)", () => {
  it.each(["=SUM(A1)", "+1+1", "-2+3", "@cmd", "\t=1", "\r=1", "=HYPERLINK(\"http://x\")", " =1+1", "\n=1"])("neutralises %j", (v) => {
    expect(needsNeutralising(v)).toBe(true);
    expect(neutralise(v).startsWith("'")).toBe(true);
    expect(neutralise(v)).toBe(`'${v}`);
  });
  it.each(["Leyla", "Məmmədov", "Иванов", "a=b", "x-y", "user@example.az", "1+1", "", "'=already"])("leaves %j alone", (v) => {
    expect(neutralise(v)).toBe(v);
  });
  it("never produces a value that starts with a trigger character (property over many inputs)", () => {
    const chars = ["=", "+", "-", "@", "\t", "\r", " ", "\n", "a", "Ə", "1", "'"];
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 2000; i++) {
      const s = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => chars[Math.floor(rnd() * chars.length)]).join("");
      const out = neutralise(s);
      expect(/^[=+\-@\t\r]/.test(out), `${JSON.stringify(s)} -> ${JSON.stringify(out)}`).toBe(false);
      expect(neutralise(out)).toBe(out); // idempotent: neutralising twice changes nothing
    }
  });
  it("cleanCell trims, strips control characters and neutralises (so a re-run of the same file stores the same text)", () => {
    expect(cleanCell("  =cmd  ")).toBe("'=cmd");
    expect(cleanCell("\t=1")).toBe("'=1");
    expect(cleanCell("a\u0000b")).toBe("ab");
    expect(cleanCell(null)).toBe("");
    expect(cleanCell(42)).toBe("42");
    expect(cleanCell(cleanCell("=x"))).toBe("'=x");
  });
  it("csvField neutralises before quoting, and quotes commas, quotes and line breaks", () => {
    expect(csvField("=1+1")).toBe("'=1+1");
    expect(csvField('a,"b"')).toBe('"a,""b"""');
    expect(csvField("x\ny")).toBe('"x\ny"');
    expect(csvField(null)).toBe("");
    expect(csvField(5)).toBe("5");
  });
  it("toCsv starts with a byte-order mark and neutralises every cell, headers included", () => {
    const out = toCsv([["=h", "ok"], ["@x", "-1"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain("'=h,ok");
    expect(out).toContain("'@x,'-1");
  });
});
