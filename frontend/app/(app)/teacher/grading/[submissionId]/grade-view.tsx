"use client";

import Link from "next/link";
import { ArrowLeft, CalendarClock, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FadeInUp } from "@/components/motion/primitives";
import {
  SubmissionStatusBadge,
  LateBadge,
  StatusPill,
} from "@/components/common/status-badge";
import { MarkingPanel } from "@/components/editor/replay/marking-panel";
import { ReplayLauncher } from "@/components/editor/replay/replay-launcher";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatDateTime, formatRelative, initialsOf } from "@/lib/format";
import type { SubmissionDetail } from "@/lib/api/types";

/**
 * Mark one submission.
 *
 * The answer occupies the main column and the marking controls a sidebar, so
 * the teacher reads the work rather than the form. Marks and feedback submit
 * together, since awarding a mark without saying why is the thing this screen
 * should make harder, not easier.
 *
 * How the work was written lives behind a single action rather than a tab
 * beside the answer: it is a different kind of reading, and it earns the whole
 * screen when it is opened.
 */
export function GradeSubmissionView({
  submission,
  backHref = "/teacher/grading",
}: {
  submission: SubmissionDetail;
  /** Where "back" leads. An administrator arrives from their own queue. */
  backHref?: string;
}) {
  const { t, locale, n } = useTranslation();

  // The assignment lives under whichever section the reader came from; sending
  // an administrator to a teacher-only route would land them on a 403.
  const area = backHref.startsWith("/admin") ? "/admin" : "/teacher";

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={backHref} />}
        className="-ms-2 text-muted-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t.grading.title}
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* The work itself */}
        <div className="space-y-4 lg:col-span-2">
          <FadeInUp className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                {initialsOf(submission.studentName)}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight">
                  {submission.studentName}
                </h1>
                <p className="truncate text-xs text-muted-foreground">
                  {submission.studentEmail}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SubmissionStatusBadge status={submission.status} />
              {submission.isLate ? <LateBadge /> : null}
              <StatusPill tone="neutral">
                <CalendarClock className="size-3" aria-hidden />
                {formatRelative(submission.submittedAt, locale)}
              </StatusPill>
            </div>

            <Link
              href={`${area}/assignments/${submission.assignmentId}`}
              className="inline-block text-sm font-medium text-primary transition-opacity hover:opacity-70"
            >
              {submission.assignmentTitle}
            </Link>
          </FadeInUp>

          <FadeInUp delay={0.04}>
            <ReplayLauncher submission={submission} />
          </FadeInUp>

          <FadeInUp delay={0.08} className="space-y-2">
            <h2 className="text-sm font-semibold">{t.grading.answer}</h2>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-pretty">
                {submission.content}
              </p>
            </div>

            <p className="text-xs text-muted-foreground tabular">
              {formatDateTime(submission.submittedAt, locale)}
              {submission.lastUpdatedAt
                ? ` · ${formatRelative(submission.lastUpdatedAt, locale)}`
                : ""}
            </p>

            {submission.attachmentUrl ? (
              <Button
                variant="outline"
                size="sm"
                render={
                  <a
                    href={submission.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  />
                }
              >
                <ExternalLink className="size-3.5" aria-hidden />
                {t.grading.openAttachment}
              </Button>
            ) : null}
          </FadeInUp>

          {submission.feedback.length > 0 ? (
            <FadeInUp delay={0.12} className="space-y-2">
              <h2 className="text-sm font-semibold">{t.grading.feedbackHistory}</h2>
              <div className="space-y-2">
                {submission.feedback.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-card p-3.5">
                    <div className="flex items-baseline justify-between gap-2 pb-1.5">
                      <p className="truncate text-xs font-medium">{item.teacherName}</p>
                      <p className="shrink-0 text-[0.6875rem] text-muted-foreground tabular">
                        {item.marksAtTime !== null ? `${n(item.marksAtTime)} · ` : ""}
                        {formatRelative(item.createdAt, locale)}
                      </p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-pretty">
                      {item.comment}
                    </p>
                  </div>
                ))}
              </div>
            </FadeInUp>
          ) : null}
        </div>

        {/* Marking controls */}
        <FadeInUp delay={0.12}>
          <MarkingPanel submission={submission} />
        </FadeInUp>
      </div>
    </div>
  );
}
