import type { Locale } from "@/lib/constants";
import { toCsv } from "./cells";
import { templateHeaders } from "./columns";
import { toXlsx } from "./spreadsheet";

/** The published import template (FR-IMP-002): the header row only, in the chosen language. Aliases in other languages are accepted on upload. */
export function templateCsv(locale: Locale): string {
  return toCsv([templateHeaders(locale)]);
}
export const templateXlsx = (locale: Locale) => toXlsx(templateHeaders(locale));
