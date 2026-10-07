import { describe, expect, it } from "vitest";
import { CsvError, decodeText, detectDelimiter, parseCsv } from "../../src/domain/people/csv";

describe("FR-IMP-001 · CSV parsing", () => {
  it("reads quoted fields, doubled quotes and embedded line breaks", () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\n"line1\nline2",z\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"'], ["line1\nline2", "z"]]);
  });
  it("skips blank lines and strips a byte-order mark and Excel's sep= hint", () => {
    expect(parseCsv("﻿sep=;\r\na;b\r\n\r\n1;2\r\n;\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("detects semicolon and tab delimiters (Excel in Azerbaijani and Russian locales writes semicolons)", () => {
    expect(detectDelimiter("a;b;c\n1,2,3")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter('"a,b",c')).toBe(",");
    expect(parseCsv("İşçi nömrəsi;Ad soyad\nE1;Leyla Məmmədova")).toEqual([["İşçi nömrəsi", "Ad soyad"], ["E1", "Leyla Məmmədova"]]);
  });
  it("rejects malformed quoting and non-UTF-8 bytes with a code", () => {
    expect(() => parseCsv('a,b\n"open,1')).toThrow(CsvError);
    expect(() => parseCsv('a,"b"x\n')).toThrow(CsvError);
    expect(() => decodeText(new Uint8Array([0xff, 0xfe, 0x41]))).toThrow(CsvError);
    expect(decodeText(new TextEncoder().encode("﻿Ç"))).toBe("Ç");
  });
});
