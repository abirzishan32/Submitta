"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/components/providers/i18n-provider";

/**
 * Label, control, hint and error in one consistent block.
 *
 * Having a single component is what keeps every form in the app spaced and
 * aligned identically, and guarantees each control is actually associated with
 * its label and error rather than merely sitting near them.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {label}
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">
            {t.common.optional}
          </span>
        ) : null}
      </Label>

      {children}

      {/* Hint is hidden once an error replaces it — showing both is noise at
          the exact moment the user needs one clear instruction. */}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A labelled checkbox with an explanatory line.
 *
 * The whole block is clickable, so the hit target matches what the eye reads as
 * one control rather than being a 16px square.
 */
export function CheckboxField({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 transition-colors",
        "hover:bg-accent/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        {hint ? (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}
