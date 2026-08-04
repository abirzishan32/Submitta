"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StaggerItem } from "@/components/motion/primitives";

/**
 * A single headline figure.
 *
 * The number leads and the label follows, because the figure is what someone
 * scans for. The icon is deliberately small and low-contrast — at dashboard
 * scale a row of large coloured icons competes with the numbers they label.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneClass = {
    default: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];

  return (
    <StaggerItem
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-subtle)]",
        "transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular leading-none">{value}</p>
          {hint ? (
            <p className="truncate text-xs text-muted-foreground/80">{hint}</p>
          ) : null}
        </div>

        {Icon ? <Icon className={cn("size-4 shrink-0", toneClass)} aria-hidden /> : null}
      </div>
    </StaggerItem>
  );
}
