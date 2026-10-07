/**
 * Brand colour maths (FR-ADM-028, AC-TEN-05.2): WCAG relative luminance and contrast ratio, the derived dark theme,
 * and the list of failing foreground/background pairs in the light and dark theme. Pure.
 */
import { CONTRAST_MIN } from "../../lib/constants-programmes";

export const BRAND_TOKENS = ["primary", "accent", "canvas", "surface", "ink", "onPrimary"] as const;
export type BrandToken = (typeof BRAND_TOKENS)[number];
export type BrandTokens = Record<BrandToken, string>;
export type ThemeName = "light" | "dark";

export const HEX = /^#[0-9a-f]{6}$/;

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function rgbToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** Lighten `fg` (keeping hue and saturation) until it reaches `min` contrast on `bg`; returns the best effort. */
function lightenToContrast(fg: string, bg: string, min: number): string {
  const [h, s, l] = rgbToHsl(fg);
  let out = fg;
  for (let L = l; L <= 1.0001; L += 0.01) {
    out = hslToHex(h, s, Math.min(L, 1));
    if (contrastRatio(out, bg) >= min) return out;
  }
  return out;
}

/** The dark theme is DERIVED from the six tokens (only six are editable): inverted roles, brand colours lightened to stay legible. */
export function deriveDark(t: BrandTokens): BrandTokens {
  const [h, s] = rgbToHsl(t.ink);
  const sat = Math.min(s, 0.3);
  const canvas = hslToHex(h, sat, 0.09);
  const surface = hslToHex(h, sat, 0.14);
  return {
    canvas,
    surface,
    ink: t.canvas,
    primary: lightenToContrast(t.primary, surface, CONTRAST_MIN),
    accent: lightenToContrast(t.accent, surface, CONTRAST_MIN),
    onPrimary: canvas,
  };
}

/** Foreground/background pairs the UI actually draws (text, links, buttons). */
export const BRAND_PAIRS: readonly (readonly [BrandToken, BrandToken])[] = [
  ["ink", "canvas"],
  ["ink", "surface"],
  ["primary", "canvas"],
  ["primary", "surface"],
  ["accent", "canvas"],
  ["accent", "surface"],
  ["onPrimary", "primary"],
];

export interface ContrastFailure {
  theme: ThemeName;
  fg: BrandToken;
  bg: BrandToken;
  ratio: number; // rounded to 2 decimals
  min: number;
}
export interface ContrastResult extends ContrastFailure { ok: boolean }

export function contrastResults(t: BrandTokens): ContrastResult[] {
  const themes: [ThemeName, BrandTokens][] = [["light", t], ["dark", deriveDark(t)]];
  return themes.flatMap(([theme, tokens]) =>
    BRAND_PAIRS.map(([fg, bg]) => {
      const ratio = Math.round(contrastRatio(tokens[fg], tokens[bg]) * 100) / 100;
      return { theme, fg, bg, ratio, min: CONTRAST_MIN, ok: ratio >= CONTRAST_MIN };
    }),
  );
}

export const contrastFailures = (t: BrandTokens): ContrastFailure[] => contrastResults(t).filter((r) => !r.ok).map(({ ok: _ok, ...f }) => f);

/** CSS custom properties for both themes. Only validated #rrggbb strings reach this function. */
export function brandCss(t: BrandTokens): string {
  for (const k of BRAND_TOKENS) if (!HEX.test(t[k])) throw new Error("brand token is not a hex colour");
  const vars = (x: BrandTokens) =>
    `--bg:${x.canvas};--surface:${x.surface};--fg:${x.ink};--brand-primary:${x.primary};--brand-accent:${x.accent};--on-primary:${x.onPrimary};`;
  return `:root{${vars(t)}}@media (prefers-color-scheme: dark){:root{${vars(deriveDark(t))}}}`;
}
