import { en, type Dictionary } from "./dictionaries/en";
import { bn } from "./dictionaries/bn";
import type { Locale } from "./config";

export const dictionaries: Record<Locale, Dictionary> = { en, bn };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}

export type { Dictionary };
export * from "./config";

/**
 * Substitutes {placeholders} in a translated string.
 *
 * Deliberately minimal — no plural rules or date formatting, because the
 * dictionaries carry separate keys where those matter. Anything unmatched is
 * left in place, so a typo shows up as `{name}` on screen rather than silently
 * disappearing.
 */
export function interpolate(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
