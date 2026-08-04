"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/components/providers/i18n-provider";
import type { PagedResult } from "@/lib/api/types";

/**
 * Debounced search box.
 *
 * Typing fires a request per keystroke without a delay, so the input holds its
 * own value and only reports upward once the user pauses. 300ms is long enough
 * to cover normal typing and short enough not to feel laggy.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(value);

  // Keep in step when the parent resets filters.
  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    if (local === value) return;

    const timer = setTimeout(() => onChange(local), 300);
    return () => clearTimeout(timer);
  }, [local, value, onChange]);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-3.5 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        placeholder={placeholder ?? t.common.search}
        aria-label={t.common.search}
        className="h-8 ps-8 pe-8"
      />
      {local ? (
        <button
          type="button"
          onClick={() => setLocal("")}
          aria-label={t.common.clear}
          className="absolute inset-y-0 end-0 flex w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Page navigation for a {@link PagedResult}.
 *
 * Shows the range rather than only the page number — "1–20 of 84" answers
 * "how much is there?" which a bare page number does not.
 */
export function Pagination<T>({
  result,
  onPageChange,
  className,
}: {
  result: PagedResult<T>;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const { t, n } = useTranslation();

  if (result.totalCount === 0) return null;

  const from = (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.totalCount);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <p className="tabular">
        {t.common.showing} {n(from)}–{n(to)} {t.common.of} {n(result.totalCount)}
      </p>

      {result.totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-xs"
            disabled={!result.hasPrevious}
            onClick={() => onPageChange(result.page - 1)}
            aria-label={t.common.previous}
          >
            <ChevronLeft className="size-3.5 rtl:rotate-180" aria-hidden />
          </Button>

          <span className="px-1.5 tabular">
            {n(result.page)} / {n(result.totalPages)}
          </span>

          <Button
            variant="outline"
            size="icon-xs"
            disabled={!result.hasNext}
            onClick={() => onPageChange(result.page + 1)}
            aria-label={t.common.next}
          >
            <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Row of filter controls above a table. */
export function FilterBar({
  children,
  onClear,
  hasFilters,
  className,
}: {
  children: React.ReactNode;
  onClear?: () => void;
  hasFilters?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}

      {hasFilters && onClear ? (
        <Button variant="ghost" size="xs" onClick={onClear} className="text-muted-foreground">
          <X className="size-3" aria-hidden />
          {t.common.clearAll}
        </Button>
      ) : null}
    </div>
  );
}
