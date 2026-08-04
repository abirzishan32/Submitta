"use client";

import { cn } from "@/lib/utils";
import { FadeInUp } from "@/components/motion/primitives";

/**
 * The heading block every page opens with.
 *
 * Having one component means the gap between title and content, and the
 * relationship between title and description, are identical on every screen —
 * which is most of what makes a set of pages feel like one product.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <FadeInUp
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground text-pretty">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </FadeInUp>
  );
}
