import { normalise } from "@/lib/search";
import type { Locale } from "@/lib/constants";

/** Canonical import columns (the published template, FR-IMP-002). */
export const CANONICAL = [
  "employee_id",
  "email",
  "display_name",
  "department",
  "job_title",
  "hire_date",
  "grade",
  "grade_order",
  "manager_employee_id",
  "status",
] as const;
export type Canonical = (typeof CANONICAL)[number];
export const REQUIRED: readonly Canonical[] = ["employee_id", "email", "display_name"];

/**
 * The header written in the downloadable template, per language, and the further documented aliases accepted on upload.
 * Matching ignores case, accents (ə/e, ı/i, ö/o, ü/u, ç/c, ş/s, ğ/g, ё/е), punctuation and spacing.
 */
const COLUMN_TEXT: Record<Canonical, { header: Record<Locale, string>; aliases: string[] }> = {
  employee_id: {
    header: { en: "Employee ID", az: "İşçi nömrəsi", ru: "Табельный номер" },
    aliases: ["employee number", "staff id", "personnel number", "emp id", "employee no", "tabel nömrəsi", "kadr nömrəsi", "işçi id", "işçi kodu", "идентификатор сотрудника", "id сотрудника", "номер сотрудника"],
  },
  email: {
    header: { en: "Work email", az: "İş e-poçtu", ru: "Рабочая почта" },
    aliases: ["email", "e-mail", "email address", "e-poçt", "e-poçt ünvanı", "elektron poçt", "электронная почта", "эл. почта", "почта", "рабочий email"],
  },
  display_name: {
    header: { en: "Full name", az: "Ad soyad", ru: "ФИО" },
    aliases: ["name", "display name", "employee name", "tam ad", "işçinin adı", "ad", "полное имя", "имя", "сотрудник", "фамилия имя"],
  },
  department: {
    header: { en: "Department", az: "Şöbə", ru: "Подразделение" },
    aliases: ["division", "unit", "departament", "bölmə", "struktur bölmə", "отдел", "департамент"],
  },
  job_title: {
    header: { en: "Job title", az: "Vəzifə", ru: "Должность" },
    aliases: ["title", "position", "vəzifə adı", "ixtisas", "позиция"],
  },
  hire_date: {
    header: { en: "Hire date", az: "İşə qəbul tarixi", ru: "Дата приёма" },
    aliases: ["start date", "date of joining", "joining date", "işə başlama tarixi", "qəbul tarixi", "дата приема", "дата найма", "дата начала работы"],
  },
  grade: {
    header: { en: "Grade", az: "Dərəcə", ru: "Грейд" },
    aliases: ["job grade", "level", "band", "səviyyə", "qrad", "уровень", "разряд", "категория"],
  },
  grade_order: {
    header: { en: "Grade order", az: "Dərəcə sırası", ru: "Порядок грейда" },
    aliases: ["grade rank", "grade sequence", "dərəcə sıra nömrəsi", "ранг грейда"],
  },
  manager_employee_id: {
    header: { en: "Manager employee ID", az: "Rəhbərin işçi nömrəsi", ru: "Табельный номер руководителя" },
    aliases: ["manager id", "line manager id", "manager number", "reports to id", "rəhbərin nömrəsi", "rəhbər işçi nömrəsi", "rəhbər id", "birbaşa rəhbərin nömrəsi", "id руководителя", "идентификатор руководителя", "номер руководителя"],
  },
  status: {
    header: { en: "Status", az: "Status", ru: "Статус" },
    aliases: ["employment status", "vəziyyət", "iş statusu", "статус занятости"],
  },
};

/** Collapses a header to letters and digits only, with accent folding, so "E-poçt ünvanı" and "e poct unvani" are equal. */
export function headerKey(raw: string): string {
  return normalise(raw).replace(/[^\p{L}\p{N}]+/gu, "");
}

const ALIAS_INDEX: Map<string, Canonical> = (() => {
  const m = new Map<string, Canonical>();
  for (const c of CANONICAL) {
    const spec = COLUMN_TEXT[c];
    for (const text of [c, ...Object.values(spec.header), ...spec.aliases]) {
      const k = headerKey(text);
      const prior = m.get(k);
      if (prior && prior !== c) throw new Error(`header alias "${text}" is ambiguous (${prior} and ${c})`);
      m.set(k, c);
    }
  }
  return m;
})();

export function templateHeaders(locale: Locale): string[] {
  return CANONICAL.map((c) => COLUMN_TEXT[c].header[locale]);
}
export const columnHeader = (c: Canonical, locale: Locale): string => COLUMN_TEXT[c].header[locale];

export interface HeaderMapping {
  /** Canonical column for each source column index (undefined = ignored). */
  byIndex: (Canonical | undefined)[];
  present: Canonical[];
  missing: Canonical[];
  duplicated: Canonical[];
  ignored: number;
}

export function mapHeaders(header: string[]): HeaderMapping {
  const byIndex: (Canonical | undefined)[] = [];
  const seen = new Map<Canonical, number>();
  const duplicated = new Set<Canonical>();
  let ignored = 0;
  for (const h of header) {
    const c = h.trim() === "" ? undefined : ALIAS_INDEX.get(headerKey(h));
    byIndex.push(c);
    if (!c) {
      if (h.trim() !== "") ignored++;
      continue;
    }
    seen.set(c, (seen.get(c) ?? 0) + 1);
    if (seen.get(c)! > 1) duplicated.add(c);
  }
  const present = CANONICAL.filter((c) => seen.has(c));
  return { byIndex, present, missing: REQUIRED.filter((c) => !seen.has(c)), duplicated: [...duplicated], ignored };
}
