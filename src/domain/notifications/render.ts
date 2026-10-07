import { env } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/i18n";
import { formatMessage, parseMessage, placeholdersOf, pluralOptionsOf, requiredPluralCategories, type FormatParams } from "./format";
import type { Locale, Messages, ParamKind, Params, TemplateDef } from "./types";

export const LOCALES: readonly Locale[] = ["en", "az", "ru"];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface RenderOpts {
  locale: Locale;
  timeZone?: string;
  baseUrl?: string;
  /** Pad every word by ~35 % to check layouts (C-112, AC-ADM-17.4). Preview only. */
  expand?: boolean;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
  link: string;
  /** Message keys missing in the requested language (the English text was used instead). */
  missing: string[];
}

export class TemplateError extends Error {}

/** Validate params against the template's declared kinds and format them for display in the recipient's language and zone. */
export function formatParams(def: TemplateDef, params: Params, locale: Locale, timeZone: string): FormatParams {
  const out: FormatParams = {};
  for (const [name, kind] of Object.entries(def.params)) {
    if (!(name in params)) throw new TemplateError(`${def.code}: missing param ${name}`);
    out[name] = formatOne(def.code, name, kind, params[name]!, locale, timeZone);
  }
  for (const name of Object.keys(params)) if (!(name in def.params)) throw new TemplateError(`${def.code}: undeclared param ${name}`);
  return out;
}

function formatOne(code: string, name: string, kind: ParamKind, v: Params[string], locale: Locale, tz: string): string | number {
  switch (kind) {
    case "name":
      if (typeof v !== "string" || v.length > 200) throw new TemplateError(`${code}.${name}: a name must be a string of at most 200 characters`);
      return v;
    case "count":
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0) throw new TemplateError(`${code}.${name}: a count must be a non-negative integer`);
      return v;
    case "code":
      if (typeof v !== "string" || !/^\d{6}$/.test(v)) throw new TemplateError(`${code}.${name}: a code is six digits`);
      return v;
    case "token":
      if (typeof v !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(v)) throw new TemplateError(`${code}.${name}: a token is URL-safe characters only`);
      return v;
    case "date":
      if (!(v instanceof Date)) throw new TemplateError(`${code}.${name}: expected a date`);
      return formatDate(v, locale, tz);
    case "datetime":
      if (!(v instanceof Date)) throw new TemplateError(`${code}.${name}: expected a date`);
      return formatDateTime(v, locale, tz);
  }
}

/** Message text for a language; English is the fallback and the gap is reported (never a raw key). */
export function messageFor(def: TemplateDef, locale: Locale, key: string, missing?: string[]): string | undefined {
  const own = def.messages[locale]?.[key];
  if (own !== undefined && own.trim() !== "") return own;
  const en = def.messages.en?.[key];
  if (en === undefined) return undefined;
  missing?.push(`${locale}:${key}`);
  return en;
}

/** Pseudo-expansion: lengthens every word by 35 % so layouts can be checked without a translator (C-112). */
export function expandText(s: string, ratio = 0.35): string {
  return s.replace(/[\p{L}]+/gu, (w) => w + w.slice(-Math.max(1, Math.round(w.length * ratio))));
}

export function linkUrl(def: TemplateDef, subjectId: string, params: Params, baseUrl = env().APP_BASE_URL): string {
  const path = def.link(subjectId, params);
  if (!path.startsWith("/") || path.startsWith("//")) throw new TemplateError(`${def.code}: link must be a page path`);
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function renderEmail(def: TemplateDef, subjectId: string, params: Params, opts: RenderOpts): RenderedEmail {
  if (!def.channels.email) throw new TemplateError(`${def.code} has no email channel`);
  const tz = opts.timeZone ?? "Asia/Baku";
  const missing: string[] = [];
  const link = linkUrl(def, subjectId, params, opts.baseUrl);
  const shown = { ...formatParams(def, params, opts.locale, tz), link };
  const subjectP = Object.fromEntries(Object.entries(shown).filter(([k]) => (def.subjectParams ?? []).includes(k)));
  let subject = formatMessage(opts.locale, messageFor(def, opts.locale, "subject", missing) ?? "", subjectP);
  let text = formatMessage(opts.locale, messageFor(def, opts.locale, "body", missing) ?? "", shown);
  if (opts.expand) {
    const keepLink = (s: string) => s.split(link).map(expandText).join(link);
    subject = expandText(subject);
    text = keepLink(text);
  }
  const html = htmlOf(text, link, opts.locale);
  return { subject, text, html, link, missing };
}

/** HTML alternative: escaped paragraphs, the link as an anchor; fluid width so +35 % text does not clip. */
export function htmlOf(text: string, link: string, locale: Locale): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => {
      let h = esc(p).replace(/\n/g, "<br>");
      h = h.replace(esc(link), `<a href="${esc(link)}">${esc(link)}</a>`);
      return `<p style="margin:0 0 12px">${h}</p>`;
    })
    .join("");
  return `<div lang="${locale}" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;max-width:560px;overflow-wrap:anywhere">${paras}</div>`;
}

export function renderInApp(def: TemplateDef, subjectId: string, params: Params, opts: RenderOpts): { text: string; href: string } {
  const tz = opts.timeZone ?? "Asia/Baku";
  const shown = formatParams(def, params, opts.locale, tz);
  const text = formatMessage(opts.locale, messageFor(def, opts.locale, "inapp") ?? "", shown);
  return { text, href: def.link(subjectId, params) };
}

// ------------------------------------------------------------------ completeness gate (NT-6, AC-ADM-17.3)
export interface Gap {
  template: string;
  locale: Locale;
  key: string;
  problem: "missing" | "empty" | "invalid" | "placeholders" | "plural";
}

export function requiredKeys(def: TemplateDef): string[] {
  const keys: string[] = [];
  if (def.channels.email) keys.push("subject", "body");
  if (def.channels.inApp) keys.push("inapp");
  return keys;
}

/** Every required key exists in en, az and ru, parses, keeps English's placeholders and provides the language's plural forms. */
export function completenessGaps(def: TemplateDef): Gap[] {
  const gaps: Gap[] = [];
  for (const key of requiredKeys(def)) {
    const en = def.messages.en?.[key];
    for (const locale of LOCALES) {
      const text = def.messages[locale]?.[key];
      const gap = (problem: Gap["problem"]) => gaps.push({ template: def.code, locale, key, problem });
      if (text === undefined) { gap("missing"); continue; }
      if (text.trim() === "") { gap("empty"); continue; }
      try {
        parseMessage(text);
      } catch {
        gap("invalid");
        continue;
      }
      if (en !== undefined && locale !== "en" && placeholdersOf(text).join(",") !== placeholdersOf(en).join(",")) gap("placeholders");
      for (const options of Object.values(pluralOptionsOf(text)))
        if (requiredPluralCategories(locale).some((cat) => !options.includes(cat))) gap("plural");
    }
  }
  return gaps;
}

/** Extra messages a translation may carry beyond the required keys are ignored; this is for tests and the picker. */
export const templateMessages = (def: TemplateDef, locale: Locale): Messages => def.messages[locale] ?? {};
export { placeholdersOf };
