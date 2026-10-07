/**
 * Message formatting for notification templates: `{name}` placeholders and ICU-style plurals
 *   {count, plural, =0{none} one{# session} few{# sessions} many{# sessions} other{# sessions}}
 * with `#` standing for the number. Plural categories come from Intl.PluralRules, so Russian one/few/many and
 * Azerbaijani/English one/other are chosen by the language, not by the template author (AC-ADM-17.1).
 * Pure; no React, no i18n catalogue.
 */
export type Locale = "en" | "az" | "ru";
export type FormatParams = Record<string, string | number>;

const CATEGORIES: Record<Locale, Intl.LDMLPluralRule[]> = {
  en: ["one", "other"],
  az: ["one", "other"],
  ru: ["one", "few", "many", "other"],
};

/** The plural categories a translation of `locale` must provide. */
export const requiredPluralCategories = (locale: Locale): readonly Intl.LDMLPluralRule[] => CATEGORIES[locale];

interface Node {
  kind: "text" | "ref" | "plural";
  text?: string;
  name?: string;
  options?: Record<string, Node[]>;
}

/** Parse into nodes. Throws on unbalanced braces so a broken translation is caught by the completeness gate. */
export function parseMessage(src: string): Node[] {
  let i = 0;
  const parseUntil = (stop: string | null): Node[] => {
    const out: Node[] = [];
    let buf = "";
    const flush = () => {
      if (buf) out.push({ kind: "text", text: buf });
      buf = "";
    };
    while (i < src.length) {
      const ch = src[i]!;
      if (stop !== null && ch === stop) break;
      if (ch === "{") {
        flush();
        i++;
        const start = i;
        let head = "";
        while (i < src.length && src[i] !== "}" && src[i] !== ",") head += src[i++];
        const name = head.trim();
        if (!/^\w+$/.test(name)) throw new Error(`bad placeholder at ${start}`);
        if (src[i] === "}") {
          i++;
          out.push({ kind: "ref", name });
          continue;
        }
        i++; // comma
        let type = "";
        while (i < src.length && src[i] !== ",") type += src[i++];
        if (type.trim() !== "plural") throw new Error(`unsupported format "${type.trim()}"`);
        i++; // comma
        const options: Record<string, Node[]> = {};
        for (;;) {
          while (/\s/.test(src[i] ?? "")) i++;
          if (src[i] === "}") {
            i++;
            break;
          }
          let sel = "";
          while (i < src.length && src[i] !== "{" && !/\s/.test(src[i]!)) sel += src[i++];
          while (/\s/.test(src[i] ?? "")) i++;
          if (!sel || src[i] !== "{") throw new Error("bad plural option");
          i++;
          options[sel] = parseUntil("}");
          if (src[i] !== "}") throw new Error("unbalanced braces");
          i++;
        }
        if (!("other" in options)) throw new Error("plural needs an 'other' option");
        out.push({ kind: "plural", name, options });
        continue;
      }
      if (ch === "}" && stop === null) throw new Error("unbalanced braces");
      buf += ch;
      i++;
    }
    flush();
    return out;
  };
  const nodes = parseUntil(null);
  if (i < src.length) throw new Error("unbalanced braces");
  return nodes;
}

export function formatMessage(locale: Locale, pattern: string, params: FormatParams): string {
  const rules = new Intl.PluralRules(locale === "az" ? "az-AZ" : locale);
  const render = (nodes: Node[], hash: number | null): string =>
    nodes
      .map((n) => {
        if (n.kind === "text") return hash === null ? n.text! : n.text!.replace(/#/g, String(hash));
        if (n.kind === "ref") return n.name! in params ? String(params[n.name!]) : `{${n.name}}`;
        const v = Number(params[n.name!]);
        const exact = n.options![`=${v}`];
        const opt = exact ?? n.options![rules.select(v)] ?? n.options!.other!;
        return render(opt, v);
      })
      .join("");
  return render(parseMessage(pattern), null);
}

/** Placeholder names a pattern uses (including plural subjects), for placeholder-parity and subject-privacy checks. */
export function placeholdersOf(pattern: string): string[] {
  const names = new Set<string>();
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.kind === "ref") names.add(n.name!);
      if (n.kind === "plural") {
        names.add(n.name!);
        for (const o of Object.values(n.options!)) walk(o);
      }
    }
  };
  walk(parseMessage(pattern));
  return [...names].sort();
}

/** Plural categories that a pattern provides for the given placeholder (empty if it has no plural on it). */
export function pluralOptionsOf(pattern: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.kind === "plural") {
        out[n.name!] = Object.keys(n.options!);
        for (const o of Object.values(n.options!)) walk(o);
      }
    }
  };
  walk(parseMessage(pattern));
  return out;
}
