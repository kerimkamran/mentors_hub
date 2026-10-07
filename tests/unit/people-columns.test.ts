import { describe, expect, it } from "vitest";
import { CANONICAL, headerKey, mapHeaders, templateHeaders } from "../../src/domain/people/columns";
import { LOCALES } from "../../src/lib/constants";

describe("FR-IMP-002 · template and header aliases", () => {
  it("the published template of every language maps back onto all canonical columns", () => {
    for (const l of LOCALES) {
      const m = mapHeaders(templateHeaders(l));
      expect(m.present, l).toEqual([...CANONICAL]);
      expect(m.missing).toEqual([]);
      expect(m.duplicated).toEqual([]);
      expect(m.ignored).toBe(0);
    }
  });
  it("recognises localised and alternative column names, ignoring case, accents and punctuation", () => {
    const m = mapHeaders(["TABEL NÖMRƏSI", "e-poçt ünvanı", "AD SOYAD", "sobe".replace("sobe", "Şöbə"), "Vezife", "Табельный номер руководителя", "ФИО", "Должность", "Employee_ID"]);
    expect(m.byIndex.slice(0, 4)).toEqual(["employee_id", "email", "display_name", "department"]);
    // "Vezife" (no diacritics) and "Employee_ID" fold onto the same columns
    expect(m.byIndex[4]).toBe("job_title");
    expect(m.byIndex[5]).toBe("manager_employee_id");
    expect(m.duplicated.sort()).toEqual(["display_name", "employee_id", "job_title"].sort());
  });
  it("reports missing required columns, duplicated columns and counts unknown columns", () => {
    const m = mapHeaders(["Employee ID", "Nickname", "Full name", "Favourite colour", ""]);
    expect(m.missing).toEqual(["email"]);
    expect(m.ignored).toBe(2);
    expect(mapHeaders(["Employee ID", "Staff ID", "Email", "Name"]).duplicated).toEqual(["employee_id"]);
  });
  it("headerKey folds ə/ı/ö/ü/ç/ş/ğ and ё", () => {
    expect(headerKey("Şöbə")).toBe(headerKey("sobe"));
    expect(headerKey("Дата приёма")).toBe(headerKey("дата приема"));
  });
});
