"use client";


import { useTheme } from "@/components/providers/theme-provider";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/providers/i18n-provider";

const OPTIONS = [
  { value: "light", icon: Sun, labelKey: "light" },
  { value: "dark", icon: Moon, labelKey: "dark" },
  { value: "system", icon: Monitor, labelKey: "system" },
] as const;

/**
 * Segmented theme control.
 *
 * A three-way segment rather than a toggle, because "system" is a real
 * preference and a two-state switch silently overrides it. All three states are
 * visible, so the current one is readable at a glance rather than inferred.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // `mounted` comes from the provider: the server cannot know which theme the
  // pre-paint script chose, so no segment is marked active until the client
  // has read localStorage — otherwise the markup would mismatch on hydration.
  const { theme, setTheme, mounted } = useTheme();
  const { t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={t.nav.toggleTheme}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, icon: Icon, labelKey }) => {
        const active = mounted && theme === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t.nav[labelKey]}
            title={t.nav[labelKey]}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-[7px] transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "bg-background text-foreground shadow-[var(--shadow-subtle)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
