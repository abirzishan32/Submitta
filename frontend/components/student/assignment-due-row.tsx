"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatRelative, formatDateTime, deadlineTone } from "@/lib/format";
import type { StudentAssignment } from "@/lib/api/types";

/**
 * One assignment in a student's list.
 *
 * A row rather than a card: assignments are compared against each other by
 * deadline, and a stack of cards makes scanning a column of dates harder than a
 * table does. The deadline is coloured by urgency using the shared
 * {@link deadlineTone} scale, so the same date reads the same everywhere.
 */
export function AssignmentDueRow({ assignment }: { assignment: StudentAssignment }) {
  const { t, locale } = useTranslation();
  const tone = deadlineTone(assignment.deadline);

  const toneClass = {
    overdue: "text-destructive",
    urgent: "text-warning",
    soon: "text-foreground",
    normal: "text-muted-foreground",
  }[tone];

  return (
    <Link
      href={`/student/assignments/${assignment.id}`}
      className={cn(
        "group flex items-center gap-3 px-4 py-3 transition-colors",
        "hover:bg-accent/50 focus-visible:outline-none focus-visible:bg-accent/50",
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">{assignment.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {assignment.classCode} · {assignment.subjectName}
        </p>
      </div>

      <div className="shrink-0 text-end">
        <p className={cn("text-xs font-medium tabular", toneClass)}>
          {formatRelative(assignment.deadline, locale)}
        </p>
        <p className="text-[0.6875rem] text-muted-foreground tabular">
          {formatDateTime(assignment.deadline, locale)}
        </p>
      </div>

      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden
      />
      <span className="sr-only">{t.common.viewDetails}</span>
    </Link>
  );
}
