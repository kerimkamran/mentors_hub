import { matching } from "../../messages/matching";
import type { Labels, Locale, MentorReasonCode, ReasonCode } from "./types";

/** Reason codes → localised sentences (FR-MAT-017). Pure: Intl.PluralRules / ListFormat / DisplayNames only read built-in locale data. */

type Dict = Record<string, string>;
const DICT: Record<Locale, Dict> = { en: matching.en, az: matching.az, ru: matching.ru };

function msg(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const raw = DICT[locale][key] ?? DICT.en[key];
  if (raw === undefined) throw new Error(`missing matching message: ${key}`);
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

const label = (l: Labels, locale: Locale) => l[locale] || l.en;

function languageName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Plural category for a count in the viewer's language (Russian one/few/many; English one/other; Azerbaijani texts are identical across categories). */
export function pluralCategory(count: number, locale: Locale): "one" | "few" | "many" | "other" {
  const c = new Intl.PluralRules(locale).select(count);
  return c === "one" || c === "few" || c === "many" ? c : "other";
}

export function renderReason(code: ReasonCode | MentorReasonCode, locale: Locale): string {
  switch (code.code) {
    case "GOAL_ALIGNMENT":
      return msg(locale, `matching.reason.goal.${code.goalPosition}`, { topic: label(code.topic, locale) });
    case "EXPERTISE":
      return msg(locale, `matching.reason.expertise.${code.depth}`, { topic: label(code.topic, locale) });
    case "AVAILABILITY":
      return msg(locale, `matching.reason.availability.${pluralCategory(code.days, locale)}`, { count: code.days });
    case "CAREER":
      return msg(locale, `matching.reason.career.${code.band}`);
    case "LANGUAGE": {
      const names = code.languages.map((l) => languageName(l, locale));
      return msg(locale, "matching.reason.language", { languages: new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(names) });
    }
    case "INTERESTS":
      return msg(locale, "matching.reason.interests", { interest: label(code.interest, locale) });
    case "COMPATIBILITY":
      return msg(locale, "matching.reason.compatibility");
    case "GENERIC_FIT":
      return msg(locale, "matching.reason.generic");
    case "MENTOR_SEEKS_TOPIC":
      return code.goalTitle ? msg(locale, "matching.mentor.seeks_titled", { topic: label(code.topic, locale), title: code.goalTitle }) : msg(locale, "matching.mentor.seeks", { topic: label(code.topic, locale) });
    case "MENTOR_GENERIC_FIT":
      return msg(locale, "matching.mentor.generic");
  }
}

/** Renders a candidate's reason codes (mentee view or mentor view) in the viewer's language. */
export function renderExplanation(codes: readonly (ReasonCode | MentorReasonCode)[], locale: Locale): string[] {
  return codes.map((c) => renderReason(c, locale));
}

/** The single neutral line shown for every excluded candidate (FR-MAT-003). Never carries a code, count or reason. */
export function renderNotAvailable(locale: Locale): string {
  return msg(locale, "matching.not_available");
}
