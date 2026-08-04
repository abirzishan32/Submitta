"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/components/providers/i18n-provider";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * A "filter by…" dropdown with a built-in "All" entry.
 *
 * Base UI's `Select.Value` renders the raw value unless given a formatter, so
 * the label lookup lives here rather than being repeated — and got wrong — at
 * every call site. An empty string means "no filter"; the sentinel used
 * internally never leaks out to the caller.
 */
export function FilterSelect({
  value,
  onChange,
  options,
  label,
  allLabel,
  className,
  width = "w-44",
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  /** Shown as the placeholder and as the accessible name. */
  label: string;
  allLabel?: string;
  className?: string;
  width?: string;
}) {
  const { t } = useTranslation();
  const ALL = "__all__";
  const allText = allLabel ?? t.common.all;

  const labelFor = (raw: unknown): string => {
    if (raw === ALL || raw === null || raw === undefined || raw === "") return allText;
    return options.find((option) => option.value === raw)?.label ?? allText;
  };

  return (
    <Select
      value={value || ALL}
      onValueChange={(next) => onChange(next === ALL ? "" : String(next))}
    >
      <SelectTrigger size="sm" aria-label={label} className={className ?? width}>
        <SelectValue placeholder={label}>{labelFor}</SelectValue>
      </SelectTrigger>

      <SelectContent>
        <SelectItem value={ALL}>{allText}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
