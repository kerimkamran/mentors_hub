import { t, type Locale } from "@/lib/i18n";

/** User-facing text for an error code carried in the query string (codes only, never free text). */
export function errorText(l: Locale, code: string, columns = ""): string {
  try {
    return t(l, `people.import.error.${code}`, { columns });
  } catch {
    return t(l, "error.generic");
  }
}
