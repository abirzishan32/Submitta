import type { Locale } from "@/lib/i18n/config";
import { localiseDigits } from "@/lib/i18n/config";

/**
 * Locale-aware formatting.
 *
 * Bangla uses its own numerals, so anything containing digits has to pass
 * through `localiseDigits` — otherwise a Bangla page shows Latin numbers, which
 * reads as an untranslated remnant.
 */

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  bn: "bn-BD",
};

export function formatDate(value: string | Date, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return localiseDigits(
    new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date),
    locale,
  );
}

export function formatDateTime(value: string | Date, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return localiseDigits(
    new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
    locale,
  );
}

/**
 * "in 3 days" / "2 hours ago", using the browser's own phrasing so it is
 * correct in both languages without us writing plural rules.
 */
export function formatRelative(value: string | Date, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(deltaSeconds);

  const formatter = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], {
    numeric: "auto",
  });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, seconds] of units) {
    if (absolute >= seconds) {
      return localiseDigits(
        formatter.format(Math.round(deltaSeconds / seconds), unit),
        locale,
      );
    }
  }

  return formatter.format(0, "second");
}

export function formatNumber(value: number, locale: Locale): string {
  return localiseDigits(
    new Intl.NumberFormat(INTL_LOCALE[locale]).format(value),
    locale,
  );
}

/**
 * Marks as "85 / 100". Trailing ".00" is dropped, since whole marks are the
 * common case and "85.00 / 100.00" is noise in a table.
 */
export function formatMarks(
  marks: number | null,
  maxMarks: number,
  locale: Locale,
): string {
  const max = trimTrailingZeros(maxMarks);

  if (marks === null) {
    return `— / ${localiseDigits(max, locale)}`;
  }

  return `${localiseDigits(trimTrailingZeros(marks), locale)} / ${localiseDigits(max, locale)}`;
}

export function formatPercentage(value: number, locale: Locale): string {
  return `${localiseDigits(trimTrailingZeros(value), locale)}%`;
}

function trimTrailingZeros(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/** Initials for an avatar fallback, from the first and last name only. */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * How urgent a deadline is, for colouring a due date consistently everywhere.
 */
export function deadlineTone(
  deadline: string | Date,
): "overdue" | "urgent" | "soon" | "normal" {
  const date = typeof deadline === "string" ? new Date(deadline) : deadline;
  const hours = (date.getTime() - Date.now()) / 3_600_000;

  if (hours < 0) return "overdue";
  if (hours <= 24) return "urgent";
  if (hours <= 72) return "soon";
  return "normal";
}
