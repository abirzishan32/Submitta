"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/providers/i18n-provider";
import type { AssignmentStatus, SubmissionStatus } from "@/lib/api/types";

/**
 * Status pills.
 *
 * Colour carries meaning consistently across the app: amber is "needs
 * attention", green is "settled", red is "a problem", slate is "not active yet".
 * A dot rather than a filled block, so a table of statuses stays calm.
 */
const statusPill = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        info: "border-info/25 bg-info/10 text-info",
        success: "border-success/25 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/12 text-warning-foreground dark:text-warning",
        danger: "border-destructive/25 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const dotTone: Record<NonNullable<VariantProps<typeof statusPill>["tone"]>, string> = {
  neutral: "bg-muted-foreground/60",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: VariantProps<typeof statusPill> & {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(statusPill({ tone }), className)}>
      <span
        className={cn("size-1.5 shrink-0 rounded-full", dotTone[tone ?? "neutral"])}
        aria-hidden
      />
      {children}
    </span>
  );
}

const ASSIGNMENT_TONE: Record<AssignmentStatus, VariantProps<typeof statusPill>["tone"]> = {
  Draft: "neutral",
  Published: "success",
  Archived: "neutral",
};

export function AssignmentStatusBadge({
  status,
  className,
}: {
  status: AssignmentStatus;
  className?: string;
}) {
  const { t } = useTranslation();

  const label = {
    Draft: t.assignments.statusDraft,
    Published: t.assignments.statusPublished,
    Archived: t.assignments.statusArchived,
  }[status];

  return (
    <StatusPill tone={ASSIGNMENT_TONE[status]} className={className}>
      {label}
    </StatusPill>
  );
}

const SUBMISSION_TONE: Record<SubmissionStatus, VariantProps<typeof statusPill>["tone"]> = {
  Submitted: "info",
  UnderReview: "warning",
  Graded: "success",
  ReturnedForRevision: "danger",
};

export function SubmissionStatusBadge({
  status,
  className,
}: {
  status: SubmissionStatus;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <StatusPill tone={SUBMISSION_TONE[status]} className={className}>
      {t.submissionStatus[status]}
    </StatusPill>
  );
}

/** Marks work handed in after the deadline. */
export function LateBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone="warning" className={className}>
      {t.grading.late}
    </StatusPill>
  );
}
