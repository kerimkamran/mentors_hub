import { ALL_TEMPLATES } from "./templates";
import type { TemplateDef } from "./types";

const byCode = new Map<string, TemplateDef>();
for (const t of ALL_TEMPLATES) {
  if (byCode.has(t.code)) throw new Error(`duplicate notification template ${t.code}`);
  byCode.set(t.code, t);
}

export const allTemplates = (): TemplateDef[] => [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
export const getTemplate = (code: string): TemplateDef | undefined => byCode.get(code);
export const isCritical = (code: string): boolean => byCode.get(code)?.critical === true;
export const inAppCodes = (): string[] => allTemplates().filter((t) => t.channels.inApp).map((t) => t.code);
