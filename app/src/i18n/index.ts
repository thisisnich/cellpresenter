import { en, type MessageKey } from "./en";

export type { MessageKey };

// Only English ships today. Adding a language means adding a catalog with the
// same keys and choosing it here.
const catalog: Record<MessageKey, string> = en;

/** Look up UI text by key and fill `{placeholders}` from `vars`. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const text = catalog[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
