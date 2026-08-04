"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Info,
  Loader2,
  Pencil,
  Send,
  Trash2,
  Undo2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

import {
  AssignmentStatusBadge,
  SubmissionStatusBadge,
  LateBadge,
  StatusPill,
} from "@/components/common/status-badge";
import { FadeInUp } from "@/components/motion/primitives";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  formatDateTime,
  formatRelative,
  formatMarks,
  deadlineTone,
  initialsOf,
} from "@/lib/format";
import type {
  AssignmentDetail,
  AssignmentSubmissions,
  MissingSubmission,
  SubmissionSummary,
} from "@/lib/api/types";

export function AssignmentDetailView({
  assignment,
  submissions,
  basePath,
}: {
  assignment: AssignmentDetail;
  submissions: AssignmentSubmissions | null;
  basePath: string;
}) {
  const { t, tx, locale, n } = useTranslation();
  const router = useRouter();

  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"delete" | "unpublish" | "archive" | null>(
    null,
  );

  async function act(
    path: string,
    successMessage: string,
    method: "post" | "delete" = "post",
    thenGoToList = false,
  ) {
    setBusy(path);

    try {
      if (method === "delete") {
        await apiClient.delete(path);
      } else {
        await apiClient.post(path);
      }

      toast.success(successMessage);

      if (thenGoToList) {
        router.push(`${basePath}/assignments`);
      }

      router.refresh();
    } catch (error) {
      // Refusals here are meaningful — "students have already submitted" is
      // the API telling the teacher to archive rather than delete.
      toast.error(error instanceof ClientApiError ? error.message : t.errors.generic);
    } finally {
      setBusy(null);
    }
  }

  const tone = deadlineTone(assignment.deadline);
  const graded = submissions?.gradedCount ?? 0;
  const received = submissions?.submittedCount ?? 0;
  const enrolled = submissions?.enrolledStudentCount ?? assignment.enrolledStudentCount;

  const columns: Column<SubmissionSummary>[] = [
    {
      key: "student",
      header: t.grading.student,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[0.6875rem] font-medium text-accent-foreground">
            {initialsOf(row.studentName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.studentName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.studentEmail}</p>
          </div>
        </div>
      ),
    },
    {
      key: "submittedAt",
      header: t.grading.submittedAt,
      secondary: true,
      cell: (row) => (
        <span className="text-xs text-muted-foreground tabular">
          {formatRelative(row.submittedAt, locale)}
        </span>
      ),
    },
    {
      key: "status",
      header: t.common.status,
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <SubmissionStatusBadge status={row.status} />
          {row.isLate ? <LateBadge /> : null}
        </div>
      ),
    },
    {
      key: "marks",
      header: t.grading.marks,
      className: "text-end",
      cell: (row) => (
        <span className="tabular text-sm">
          {row.status === "Graded" ? formatMarks(row.marks, row.maxMarks, locale) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`${basePath}/assignments`} />}
        className="-ms-2 text-muted-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t.assignments.title}
      </Button>

      <PageHeader
        title={assignment.title}
        description={`${assignment.className} · ${assignment.subjectName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`${basePath}/assignments/${assignment.id}/edit`} />}
            >
              <Pencil className="size-3.5" aria-hidden />
              {t.common.edit}
            </Button>

            {assignment.status === "Draft" ? (
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  act(
                    `/api/v1/assignments/${assignment.id}/publish`,
                    t.assignments.published,
                  )
                }
              >
                {busy?.endsWith("/publish") ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-3.5" aria-hidden />
                )}
                {t.assignments.publish}
              </Button>
            ) : null}

            {assignment.status === "Published" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => setConfirming("unpublish")}
                >
                  <Undo2 className="size-3.5" aria-hidden />
                  {t.assignments.unpublish}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => setConfirming("archive")}
                >
                  <Archive className="size-3.5" aria-hidden />
                  {t.assignments.archive}
                </Button>
              </>
            ) : null}

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.common.delete}
              title={t.common.delete}
              disabled={busy !== null}
              onClick={() => setConfirming("delete")}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        }
      />

      <FadeInUp delay={0.04} className="flex flex-wrap items-center gap-2">
        <AssignmentStatusBadge status={assignment.status} />
        <StatusPill tone={tone === "overdue" ? "danger" : tone === "urgent" ? "warning" : "neutral"}>
          <CalendarClock className="size-3" aria-hidden />
          {formatDateTime(assignment.deadline, locale)} ·{" "}
          {formatRelative(assignment.deadline, locale)}
        </StatusPill>
        <StatusPill tone="neutral">
          {tx(t.grading.outOf, { max: n(assignment.maxMarks) })}
        </StatusPill>
        {assignment.allowLateSubmission ? (
          <StatusPill tone="warning">{t.assignments.allowLateSubmission}</StatusPill>
        ) : null}
      </FadeInUp>

      {assignment.status === "Draft" ? (
        <FadeInUp
          delay={0.06}
          className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="text-sm text-warning-foreground dark:text-warning">
            {t.assignments.draftNotice}
          </p>
        </FadeInUp>
      ) : null}

      <FadeInUp delay={0.08} className="rounded-lg border border-border bg-card p-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-pretty">
          {assignment.description}
        </p>
      </FadeInUp>

      {submissions ? (
        <FadeInUp delay={0.12} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{t.assignments.submissions}</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground tabular">
                {tx(t.grading.progress, { graded: n(graded), total: n(received) })}
              </span>
              <Progress
                value={received === 0 ? 0 : (graded / received) * 100}
                className="h-1.5 w-24"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile
              icon={Users}
              label={t.classes.students}
              value={n(enrolled)}
            />
            <SummaryTile
              icon={Send}
              label={t.dashboard.submitted}
              value={`${n(received)} / ${n(enrolled)}`}
            />
            <SummaryTile
              icon={CheckCircle2}
              label={t.dashboard.graded}
              value={n(graded)}
              tone="success"
            />
          </div>

          <DataTable
            columns={columns}
            rows={submissions.submissions}
            getRowKey={(row) => row.id}
            emptyIcon={Send}
            emptyTitle={t.grading.empty}
            onRowClick={(row) => router.push(`${basePath}/grading/${row.id}`)}
          />

          {submissions.notSubmitted.length > 0 ? (
            <NotSubmittedList students={submissions.notSubmitted} />
          ) : null}
        </FadeInUp>
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming === "delete"
            ? t.common.delete
            : confirming === "archive"
              ? t.assignments.archive
              : t.assignments.unpublish
        }
        description={
          confirming === "delete"
            ? tx(t.assignments.deleteConfirm, { title: assignment.title })
            : assignment.title
        }
        destructive={confirming === "delete"}
        confirmLabel={
          confirming === "delete"
            ? t.common.delete
            : confirming === "archive"
              ? t.assignments.archive
              : t.assignments.unpublish
        }
        onConfirm={async () => {
          if (confirming === "delete") {
            await act(
              `/api/v1/assignments/${assignment.id}`,
              t.assignments.deleted,
              "delete",
              true,
            );
          } else if (confirming === "archive") {
            await act(
              `/api/v1/assignments/${assignment.id}/archive`,
              t.assignments.archived,
            );
          } else {
            await act(
              `/api/v1/assignments/${assignment.id}/unpublish`,
              t.assignments.unpublished,
            );
          }
        }}
      />
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3.5">
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular leading-tight">{value}</p>
      </div>
      <Icon
        className={cn(
          "size-4 shrink-0",
          tone === "success" ? "text-success" : "text-muted-foreground",
        )}
      />
    </div>
  );
}

/**
 * Who has not submitted.
 *
 * A grading page that only lists what arrived answers half the question — the
 * outstanding names are usually the ones a teacher needs to act on.
 */
function NotSubmittedList({ students }: { students: MissingSubmission[] }) {
  const { t, tx, n } = useTranslation();

  return (
    <div className="rounded-lg border border-dashed border-border/80 p-4">
      <p className="pb-2.5 text-xs font-medium text-muted-foreground">
        {tx(t.grading.notSubmittedCount, { count: n(students.length) })}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {students.map((student) => (
          <span
            key={student.studentId}
            title={student.studentEmail}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs"
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-background text-[0.5625rem] font-medium">
              {initialsOf(student.studentName)}
            </span>
            {student.studentName}
          </span>
        ))}
      </div>
    </div>
  );
}

