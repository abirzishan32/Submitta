"use client";

import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/common/status-badge";

/**
 * Static mockups of the real interface.
 *
 * Built from the same primitives and the same data shapes the application
 * actually uses — the status pills here are the exact component the grading
 * screen renders — so the page shows the product rather than an illustration of
 * it. Nothing is a screenshot, so these stay correct in both themes and at
 * every width.
 *
 * Purely decorative: the whole tree is aria-hidden, since a screen reader
 * gains nothing from a picture of a table it can read for real after signing in.
 */

function Window({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-overlay)]",
        className,
      )}
    >
      {/* A title strip rather than fake traffic lights — this is an app pane,
          not a browser window, and drawing macOS chrome would be a lie. */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2">
        <span className="size-1.5 rounded-full bg-muted-foreground/30" />
        <span className="text-[0.6875rem] font-medium text-muted-foreground">
          {title}
        </span>
      </div>

      {children}
    </div>
  );
}

const ROWS = [
  {
    title: "Quadratic Equations Problem Set",
    meta: "G10-A · Mathematics",
    due: "in 6 days",
    tone: "success" as const,
    status: "Published",
    count: "2 / 2",
  },
  {
    title: "Newton's Laws Lab Report",
    meta: "G10-A · Physics",
    due: "tomorrow",
    tone: "success" as const,
    status: "Published",
    count: "0 / 2",
  },
  {
    title: "Trigonometry Worksheet",
    meta: "G10-A · Mathematics",
    due: "in 2 weeks",
    tone: "neutral" as const,
    status: "Draft",
    count: "—",
  },
];

/** The teacher's assignment list. */
export function AssignmentListMockup({ className }: { className?: string }) {
  return (
    <Window title="Assignments" className={className}>
      <div className="divide-y divide-border">
        {ROWS.map((row) => (
          <div key={row.title} className="flex items-center gap-3 px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-medium leading-tight">
                {row.title}
              </p>
              <p className="truncate pt-0.5 text-[0.6875rem] text-muted-foreground">
                {row.meta}
              </p>
            </div>

            <StatusPill tone={row.tone} className="hidden shrink-0 sm:inline-flex">
              {row.status}
            </StatusPill>

            <div className="w-16 shrink-0 text-end">
              <p
                className={cn(
                  "text-[0.6875rem] tabular",
                  row.due === "tomorrow" ? "text-warning" : "text-muted-foreground",
                )}
              >
                {row.due}
              </p>
              <p className="text-[0.6875rem] text-muted-foreground/70 tabular">
                {row.count}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Window>
  );
}

/** The grading panel: marks, feedback, and the resulting state. */
export function GradingMockup({ className }: { className?: string }) {
  return (
    <Window title="Grade submission" className={className}>
      <div className="space-y-3 p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[0.625rem] font-medium text-accent-foreground">
            TR
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-medium leading-tight">
              Tanvir Rahman
            </p>
            <p className="truncate text-[0.6875rem] text-muted-foreground">
              Quadratic Equations Problem Set
            </p>
          </div>
          <StatusPill tone="success" className="shrink-0">
            Graded
          </StatusPill>
        </div>

        <div className="flex items-baseline gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <span className="text-2xl font-semibold tabular leading-none">85</span>
          <span className="text-sm text-muted-foreground tabular">/ 100</span>
        </div>

        <div className="rounded-lg border border-border p-2.5">
          <p className="text-[0.625rem] font-medium text-muted-foreground">
            Sarah Ahmed
          </p>
          <p className="pt-1 text-[0.6875rem] leading-relaxed text-foreground/80">
            Correct throughout and clearly presented. Marks withheld on Q7 and Q11
            because the working jumps straight to the result.
          </p>
        </div>
      </div>
    </Window>
  );
}

/** The student's view of a deadline that has passed. */
export function StudentStateMockup({ className }: { className?: string }) {
  return (
    <Window title="Normalization Exercise" className={className}>
      <div className="space-y-2.5 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill tone="info">Submitted</StatusPill>
          <StatusPill tone="warning">Late</StatusPill>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
          <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
            The deadline has passed, so this submission can no longer be edited.
          </p>
        </div>
      </div>
    </Window>
  );
}
