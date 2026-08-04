"use client";

import { useTheme } from "@/components/providers/theme-provider";
import { Toaster as Sonner } from "sonner";

/**
 * Toast host, themed from the design tokens rather than Sonner's defaults, so
 * notifications match the rest of the surface in both light and dark.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme as "light" | "dark") ?? "system"}
      position="bottom-right"
      // Long enough to read a sentence, short enough not to linger.
      duration={4000}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group rounded-lg border border-border bg-popover text-popover-foreground shadow-[var(--shadow-overlay)]",
          title: "text-sm font-medium",
          description: "text-sm text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-destructive",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-info",
        },
      }}
    />
  );
}
