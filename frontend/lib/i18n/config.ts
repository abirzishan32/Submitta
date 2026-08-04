/**
 * Locale configuration.
 *
 * The locale lives in a cookie rather than in the URL. This is an authenticated
 * dashboard, not indexable content, so per-locale URLs would buy nothing and
 * cost a `[locale]` segment on every route. A cookie also survives navigation
 * between server and client components without threading a param through.
 */

export const LOCALES = ["en", "bn"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "locale";

/** One year — a language choice is not something to ask about twice. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, { name: string; nativeName: string }> = {
  en: { name: "English", nativeName: "English" },
  bn: { name: "Bangla", nativeName: "বাংলা" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}

/**
 * Bengali numerals, so numbers match the surrounding script rather than sitting
 * in it as Latin digits.
 */
const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function localiseDigits(value: string | number, locale: Locale): string {
  const text = String(value);
  if (locale !== "bn") return text;
  return text.replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)]);
}
