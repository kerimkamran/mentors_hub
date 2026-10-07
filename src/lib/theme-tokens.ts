/**
 * Colour tokens for the light and dark themes (FR-ADM-029, AC-ADM-23.1). This file is the single source: globals.css
 * must carry the same values (a test compares them) and every foreground/background pair below must pass WCAG 2.2 AA
 * (4.5:1 for text, 3:1 for borders and focus rings) in BOTH themes (the contrast gate).
 */
export type ThemeName = "light" | "dark";

export const THEME_TOKENS = {
  light: {
    bg: "#ffffff", fg: "#111827", muted: "#4b5563", surface: "#f3f4f6", border: "#6b7280",
    accent: "#111827", "accent-fg": "#ffffff", link: "#1d4ed8",
    ok: "#166534", warn: "#92400e", bad: "#b91c1c",
    "banner-bg": "#e0f2fe", "banner-fg": "#0c4a6e", focus: "#1d4ed8",
  },
  dark: {
    bg: "#0b1020", fg: "#e5e7eb", muted: "#9ca3af", surface: "#151b2e", border: "#7b8497",
    accent: "#e5e7eb", "accent-fg": "#0b1020", link: "#93c5fd",
    ok: "#86efac", warn: "#fcd34d", bad: "#fca5a5",
    "banner-bg": "#172554", "banner-fg": "#dbeafe", focus: "#93c5fd",
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

export type TokenName = keyof (typeof THEME_TOKENS)["light"];

/** [foreground, background, minimum contrast]. Text 4.5, non-text (borders, focus) 3. */
export const CONTRAST_PAIRS: [TokenName, TokenName, number][] = [
  ["fg", "bg", 4.5], ["fg", "surface", 4.5], ["muted", "bg", 4.5], ["muted", "surface", 4.5],
  ["accent-fg", "accent", 4.5], ["link", "bg", 4.5], ["link", "surface", 4.5],
  ["ok", "bg", 4.5], ["ok", "surface", 4.5], ["warn", "bg", 4.5], ["warn", "surface", 4.5], ["bad", "bg", 4.5], ["bad", "surface", 4.5],
  ["banner-fg", "banner-bg", 4.5], ["border", "bg", 3], ["border", "surface", 3], ["focus", "bg", 3], ["focus", "surface", 3],
];

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export const THEMES = ["light", "dark", "system"] as const;
export const DENSITIES = ["comfortable", "dense"] as const;
export type Theme = (typeof THEMES)[number];
export type Density = (typeof DENSITIES)[number];
