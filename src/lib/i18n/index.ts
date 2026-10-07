import { LOCALES, type Locale } from "../constants";
import { core } from "../../messages/core";
import { people } from "../../messages/people";
import { profiles } from "../../messages/profiles";
import { vetting } from "../../messages/vetting";
import { matching } from "../../messages/matching";

export { LOCALES };
export type { Locale };

/**
 * Message catalogue. Each area has its own folder under src/messages/<area>/ exporting
 * `defineMessages({en}, {az}, {ru})` (see ./define.ts); the compiler rejects a missing key and
 * tests/unit/i18n.test.ts rejects empty values (AC-TEN-02.4: the user never sees a raw key).
 * Register new areas in the CATALOGUES list below.
 */
export const CATALOGUES = [core, people, profiles, vetting, matching];

type Dict = Record<string, string>;
const merged: Record<Locale, Dict> = { en: {}, az: {}, ru: {} };
for (const c of CATALOGUES) for (const l of LOCALES) Object.assign(merged[l], c[l]);

export function isLocale(x: unknown): x is Locale {
  return typeof x === "string" && (LOCALES as readonly string[]).includes(x);
}

export function t(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const raw = merged[locale][key] ?? merged.en[key];
  if (raw === undefined) throw new Error(`missing translation key: ${key}`);
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

export const allKeys = () => Object.keys(merged.en);
export const catalogue = (locale: Locale): Readonly<Dict> => merged[locale];

/** 24-hour clock, Monday-first weeks, default Asia/Baku (C-110, C-111). */
export function formatDateTime(d: Date, locale: Locale, timeZone = "Asia/Baku"): string {
  return new Intl.DateTimeFormat(locale === "az" ? "az-AZ" : locale === "ru" ? "ru-RU" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    timeZone,
  }).format(d);
}

export function formatDate(d: Date, locale: Locale, timeZone = "Asia/Baku"): string {
  return new Intl.DateTimeFormat(locale === "az" ? "az-AZ" : locale === "ru" ? "ru-RU" : "en-GB", {
    dateStyle: "medium",
    timeZone,
  }).format(d);
}

export const WEEK_STARTS_ON = 1; // Monday (C-111)
