/** Ensures all three languages define exactly the same keys (compile-time completeness). */
export function defineMessages<const E extends Record<string, string>>(
  en: E,
  az: Record<keyof E, string>,
  ru: Record<keyof E, string>,
): { en: E; az: Record<keyof E, string>; ru: Record<keyof E, string> } {
  return { en, az, ru };
}
