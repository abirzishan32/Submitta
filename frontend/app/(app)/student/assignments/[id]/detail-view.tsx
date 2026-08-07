"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Info,
  FileText,
  Loader2,
  Lock,
  MessageSquare,
  PenLine,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { RichText } from "@/components/editor/rich-text";
import { FadeInUp } from "@/components/motion/primitives";
import { SubmissionStatusBadge, LateBadge, StatusPill } from "@/components/common/status-badge";
import { useTranslation } from "@/components/providers/i18n-provider";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { formatDateTime, formatRelative, formatMarks, deadlineTone } from "@/lib/format";
import type { StudentAssignmentDetail } from "@/lib/api/types";

export function AssignmentDetailView({
  assignment,
}: {
  assignment: StudentAssignmentDetail;
}) {
  const { t, locale, n } = useTranslation();
  const router = useRouter();

  const submission = assignment.mySubmission;
  const isEditing = Boolean(submission);

  const schema = z.object({
    attachmentUrl: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || /^https?:\/\/\S+$/i.test(value),
        t.validation.url,
      )
      .optional(),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { attachmentUrl: submission?.attachmentUrl ?? "" },
  });

  const [formError, setFormError] = useState<string | null>(null);
  const { isSubmitting } = form.formState;

  const canAct = assignment.canSubmit || assignment.canEdit;

  /**
   * Saves the attachment link only.
   *
   * The answer itself is written in the editor, which owns the document and its
   * edit history; sending the content from here as well would give one field two
   * sources of truth.
   */
  async function onSubmit(values: z.infer<typeof schema>) {
    setFormError(null);

    if (!submission) return;

    try {
      await apiClient.put(`/api/v1/student/submissions/${submission.id}`, {
        content: submission.content,
        attachmentUrl: values.attachmentUrl?.trim() || null,
      });
      toast.success(t.student.updated);

      router.refresh();
    } catch (error) {
      if (error instanceof ClientApiError) {
        // Field errors from the API land on the matching input; anything else
        // becomes a form-level message.
        const fields = error.fieldErrors;

        if (fields.length > 0) {
          for (const { field, message } of fields) {
            form.setError(field as keyof z.infer<typeof schema>, { message });
          }
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError(t.errors.generic);
      }
    }
  }

  const tone = deadlineTone(assignment.deadline);

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/student/assignments" />}
        className="-ms-2 text-muted-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t.student.myAssignments}
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <FadeInUp className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="neutral">
                {assignment.classCode} · {assignment.subjectName}
              </StatusPill>
              {submission ? <SubmissionStatusBadge status={submission.status} /> : null}
              {submission?.isLate ? <LateBadge /> : null}
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {assignment.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3.5" aria-hidden />
                {assignment.teacherName}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 tabular",
                  tone === "overdue" && "text-destructive",
                  tone === "urgent" && "text-warning",
                )}
              >
                <CalendarClock className="size-3.5" aria-hidden />
                {formatDateTime(assignment.deadline, locale)} ·{" "}
                {formatRelative(assignment.deadline, locale)}
              </span>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.04} className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-5">
              {/* Rendered by the same component that wrote it, so the brief
                  reads exactly as the teacher composed it. */}
              <RichText
                value={assignment.descriptionJson}
                fallback={assignment.description}
              />
            </div>

            {assignment.attachments.length > 0 ? (
              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold">Question paper</h2>
                <ul className="space-y-1.5">
                  {assignment.attachments.map((file) => (
                    <li key={file.id}>
                      <a
                        href={`/api/proxy/api/v1/assignments/${assignment.id}/attachments/${file.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-accent/50"
                      >
                        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
                          {file.fileName}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">
                          {Math.max(1, Math.round(file.sizeBytes / 1024))} KB
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Shown before they start, not only after marking — a rubric is
                only useful if the student knows what it asks for. */}
            {assignment.rubric.length > 0 ? (
              <div className="space-y-1.5">
                <h2 className="text-sm font-semibold">How this is marked</h2>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {assignment.rubric.map((criterion) => (
                    <li key={criterion.id} className="p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium">{criterion.title}</p>
                        <span className="shrink-0 text-xs tabular">
                          {criterion.points !== null && criterion.points !== undefined ? (
                            <>
                              <span className="font-semibold">{n(criterion.points)}</span>
                              <span className="text-muted-foreground">
                                {" "}/ {n(criterion.maxPoints)}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              {n(criterion.maxPoints)} marks
                            </span>
                          )}
                        </span>
                      </div>

                      {criterion.description ? (
                        <p className="pt-0.5 text-xs text-muted-foreground text-pretty">
                          {criterion.description}
                        </p>
                      ) : null}

                      {criterion.comment ? (
                        <p className="mt-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-pretty">
                          {criterion.comment}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </FadeInUp>

          {/* Submission form, or a clear reason why it is unavailable. */}
          <FadeInUp delay={0.08} className="space-y-3">
            <h2 className="text-sm font-semibold">
              {isEditing ? t.student.yourSubmission : t.student.submit}
            </h2>

            {!canAct && assignment.blockedReason ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-4">
                <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 space-y-2">
                  <p className="text-sm text-muted-foreground">{assignment.blockedReason}</p>
                  {submission ? (
                    <div className="rounded-md border border-border bg-card p-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {submission.content}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* A late submission is warned about before it is made, not after. */}
                {assignment.canSubmit && assignment.isPastDeadline && assignment.blockedReason ? (
                  <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                    <p className="text-xs text-warning-foreground dark:text-warning">
                      {assignment.blockedReason}
                    </p>
                  </div>
                ) : null}

                {/* The answer is written in the editor, which records how it was
                    written. This page stays a summary of the assignment. */}
                <div className="rounded-lg border border-border bg-card p-4">
                  {submission?.content?.trim() ? (
                    <>
                      <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                        {submission.content}
                      </p>
                      <Separator className="my-3.5" />
                    </>
                  ) : (
                    <p className="pb-3.5 text-sm text-muted-foreground text-pretty">
                      {t.student.yourAnswerPlaceholder}
                    </p>
                  )}

                  <Button render={<Link href={`/student/assignments/${assignment.id}/write`} />}>
                    <PenLine className="size-4" aria-hidden />
                    {isEditing ? t.student.updateSubmission : t.student.submit}
                  </Button>
                </div>

                {isEditing ? (
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1.5" noValidate>
                    <Label htmlFor="attachmentUrl">
                      {t.student.attachmentUrl}
                      <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                        {t.common.optional}
                      </span>
                    </Label>

                    <div className="flex gap-2">
                      <Input
                        id="attachmentUrl"
                        type="url"
                        placeholder="https://…"
                        aria-invalid={Boolean(form.formState.errors.attachmentUrl)}
                        {...form.register("attachmentUrl")}
                      />
                      <Button type="submit" variant="outline" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : null}
                        {t.common.save}
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">{t.student.attachmentHint}</p>

                    {form.formState.errors.attachmentUrl ? (
                      <p role="alert" className="text-xs text-destructive">
                        {form.formState.errors.attachmentUrl.message}
                      </p>
                    ) : null}

                    {formError ? (
                      <p
                        role="alert"
                        className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
                      >
                        {formError}
                      </p>
                    ) : null}
                  </form>
                ) : null}
              </div>
            )}
          </FadeInUp>
        </div>

        {/* Result and feedback */}
        <FadeInUp delay={0.12} className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {t.student.resultTitle}
            </p>

            {submission?.status === "Graded" ? (
              <div className="mt-2 space-y-1">
                <p className="text-3xl font-semibold tabular leading-none">
                  {formatMarks(submission.marks, submission.maxMarks, locale)}
                </p>
                {submission.gradedByTeacherName && submission.gradedAt ? (
                  <p className="text-xs text-muted-foreground">
                    {t.grading.gradedBy.replace("{name}", submission.gradedByTeacherName)} ·{" "}
                    {formatRelative(submission.gradedAt, locale)}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium">{t.student.notYetGraded}</p>
                <p className="text-xs text-muted-foreground">
                  {submission ? t.student.awaitingReview : t.grading.notSubmitted}
                </p>
                <p className="pt-1 text-xs text-muted-foreground tabular">
                  {t.grading.outOf.replace("{max}", n(assignment.maxMarks))}
                </p>
              </div>
            )}
          </div>

          {submission && submission.feedback.length > 0 ? (
            <div className="space-y-2.5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <MessageSquare className="size-3.5 text-muted-foreground" aria-hidden />
                {t.student.teacherFeedback}
              </h2>

              <div className="space-y-2">
                {submission.feedback.map((item, index) => (
                  <div key={index} className="rounded-lg border border-border bg-card p-3.5">
                    <div className="flex items-baseline justify-between gap-2 pb-1.5">
                      <p className="truncate text-xs font-medium">{item.teacherName}</p>
                      <p className="shrink-0 text-[0.6875rem] text-muted-foreground tabular">
                        {formatRelative(item.createdAt, locale)}
                      </p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-pretty">
                      {item.comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {submission?.attachmentUrl ? (
            <>
              <Separator />
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
                className="w-full"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                {t.grading.openAttachment}
              </Button>
            </>
          ) : null}
        </FadeInUp>
      </div>
    </div>
  );
}
