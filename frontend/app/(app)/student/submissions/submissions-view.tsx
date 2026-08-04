"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, FileCheck, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/list-controls";
import {
  SubmissionStatusBadge,
  LateBadge,
} from "@/components/common/status-badge";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { apiClient } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatDateTime, formatRelative, formatMarks } from "@/lib/format";
import type { PagedResult, StudentSubmission } from "@/lib/api/types";

/**
 * The student's own submissions.
 *
 * Cards rather than a table: the useful content here is the mark and the
 * teacher's comment, which are prose, not columns to compare across rows.
 */
export function SubmissionsView({
  initial,
}: {
  initial: PagedResult<StudentSubmission>;
}) {
  const { t, locale } = useTranslation();

  const [result, setResult] = useState(initial);
  const [page, setPage] = useState(1);
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    const data = await apiClient.get<PagedResult<StudentSubmission>>(
      "/api/v1/student/submissions",
      { page, pageSize: 20 },
    );

    setResult(data);
  }, [page]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      return;
    }
    startTransition(() => void load());
  }, [load, mounted]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.student.mySubmissions}
        description={t.student.mySubmissionsSubtitle}
      />

      {result.items.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title={t.student.noSubmissions}
          description={t.student.emptyHint}
        />
      ) : (
        <>
          <Stagger className="space-y-3">
            {result.items.map((submission) => {
              const latestFeedback = submission.feedback.at(-1);

              return (
                <StaggerItem key={submission.id}>
                  <Link
                    href={`/student/assignments/${submission.assignmentId}`}
                    className={cn(
                      "group block rounded-lg border border-border bg-card p-4 transition-shadow duration-200",
                      "hover:shadow-[var(--shadow-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <p className="truncate font-medium">
                          {submission.assignmentTitle}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <SubmissionStatusBadge status={submission.status} />
                          {submission.isLate ? <LateBadge /> : null}
                        </div>

                        <p className="text-xs text-muted-foreground tabular">
                          {formatDateTime(submission.submittedAt, locale)}
                          {submission.lastUpdatedAt
                            ? ` · ${formatRelative(submission.lastUpdatedAt, locale)}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-end">
                          <p className="text-lg font-semibold tabular leading-none">
                            {submission.status === "Graded"
                              ? formatMarks(
                                  submission.marks,
                                  submission.maxMarks,
                                  locale,
                                )
                              : "—"}
                          </p>
                          {submission.status !== "Graded" ? (
                            <p className="pt-1 text-[0.6875rem] text-muted-foreground">
                              {t.student.notYetGraded}
                            </p>
                          ) : null}
                        </div>

                        <ChevronRight
                          className="size-4 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </div>
                    </div>

                    {latestFeedback ? (
                      <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/50 p-2.5">
                        <MessageSquare
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {latestFeedback.teacherName}:
                          </span>{" "}
                          {latestFeedback.comment}
                        </p>
                      </div>
                    ) : null}
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>

          <Pagination result={result} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
