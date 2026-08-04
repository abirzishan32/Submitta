"use client";

import { Check, Languages } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/components/providers/i18n-provider";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";

/**
 * English ⇄ Bangla switcher.
 *
 * Each language is listed in its own script, so someone who cannot read the
 * current interface can still find their own — the usual failure of a switcher
 * that lists "Bengali" in English only.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, locale, setLocale, isChanging } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.nav.changeLanguage}
            disabled={isChanging}
            className={cn("gap-1.5 px-2", className)}
          >
            <Languages className="size-4" aria-hidden />
            <span className="text-xs font-medium uppercase tabular">{locale}</span>
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="min-w-40">
        {LOCALES.map((value) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setLocale(value)}
            className="justify-between gap-3"
          >
            <span className={value === "bn" ? "font-[family-name:var(--font-bengali)]" : undefined}>
              {LOCALE_LABELS[value].nativeName}
            </span>
            {locale === value ? (
              <Check className="size-3.5 text-primary" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
