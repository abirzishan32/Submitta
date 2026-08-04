"use client";

import { createContext, useCallback, useContext, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  getDictionary,
  interpolate,
  localiseDigits,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";

interface I18nContextValue {
  locale: Locale;
  dictionary: Dictionary;
  setLocale: (locale: Locale) => void;
  isChanging: boolean;
  /** Formats a number in the active locale's numerals. */
  n: (value: number | string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isChanging, startTransition] = useTransition();

  const dictionary = useMemo(() => getDictionary(locale), [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      // Written from the client so the choice persists, then the server
      // components are refreshed so their own strings switch too — a locale
      // held only in React state would leave server-rendered text behind.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      startTransition(() => router.refresh());
    },
    [router],
  );

  const n = useCallback(
    (value: number | string) => localiseDigits(value, locale),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, dictionary, setLocale, isChanging, n }),
    [locale, dictionary, setLocale, isChanging, n],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider.");
  }

  return context;
}

/**
 * The dictionary plus an interpolating helper.
 *
 *   const { t, tx } = useTranslation();
 *   t.users.title                      // "Users"
 *   tx(t.dashboard.welcome, { name })  // "Welcome back, Sarah"
 */
export function useTranslation() {
  const { dictionary, locale, n, setLocale, isChanging } = useI18n();

  const tx = useCallback(
    (template: string, values?: Record<string, string | number>) =>
      interpolate(template, values),
    [],
  );

  return { t: dictionary, tx, locale, n, setLocale, isChanging };
}

export { DEFAULT_LOCALE };
