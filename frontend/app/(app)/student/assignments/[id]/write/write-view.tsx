"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  Loader2,
  Lock,
  Printer,
  Send,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusPill, SubmissionStatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { AssignmentEditor } from "@/components/editor/assignment-editor";
import { VersionHistory } from "@/components/editor/version-history";
import type { EditingRecorder } from "@/lib/editor/recorder";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatDateTime, formatRelative, deadlineTone } from "@/lib/format";
import type { StudentAssignmentDetail } from "@/lib/api/types";
import type { EditorSession } from "@/lib/api/editor-types";

/**
 * The writing surface for one assignment.
 *
 * A page of its own rather than a panel on the detail view: writing the essay
 * is the task, so everything that is not the document belongs at the edges.
 */
export function WriteView({
  assignment,
  session,
}: {
  assignment: StudentAssignmentDetail;
  session: EditorSession | null;
}) {
  const { t, locale, n } = useTranslation();
  const router = useRouter();

  const submission = assignment.mySubmission;

  const [words, setWords] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const editorRef = useRef<Editor | null>(null);
  const recorderRef = useRef<EditingRecorder | null>(null);

  const tone = deadlineTone(assignment.deadline);
  const readOnly = session !== null && !session.editable;
  const draftKey = `draft:assignment:${assignment.id}`;

  async function submit() {
    const editor = editorRef.current;
    if (!editor) return;

    setSubmitting(true);

    const contentJson = JSON.stringify(editor.getJSON());
    const plainText = editor.getText();

    try {
      if (submission) {
        // Existing work: the document goes with its log and a version marker,
        // so what was submitted is a snapshot rather than an inference.
        await apiClient.post(`/api/v1/submissions/${submission.id}/events`, {
          events: recorderRef.current?.drain() ?? [],
          contentJson,
          plainText,
          createVersion: true,
          versionReason: "submit",
        });

        toast.success(t.student.updated);
      } else {
        // First submission: create it, then hand over the log recorded while it
        // did not yet exist, so the replay starts at the first keystroke.
        const created = await apiClient.post<{ id: string; isLate: boolean }>(
          `/api/v1/student/assignments/${assignment.id}/submit`,
          { content: plainText, contentJson, attachmentUrl: null },
        );

        const events = recorderRef.current?.drain() ?? [];

        if (events.length > 0) {
          await apiClient.post(`/api/v1/submissions/${created.id}/events`, {
            events,
            contentJson: null,
            plainText: null,
            createVersion: true,
            versionReason: "submit",
          });
        }

        localStorage.removeItem(draftKey);
        toast.success(created.isLate ? t.student.submittedLate : t.student.submitted);
      }

      router.push(`/student/assignments/${assignment.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : t.errors.generic);
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/student/assignments/${assignment.id}`} />}
        className="-ms-2 text-muted-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t.common.back}
      </Button>

      {/* Assignment context, sticky: the deadline and the mark scheme are the
          two things a student re-checks most while writing. */}
      <div className="sticky top-14 z-20 rounded-lg border border-border bg-card/95 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {assignment.title}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {assignment.classCode} · {assignment.subjectName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {submission ? (
              <SubmissionStatusBadge status={submission.status} />
            ) : (
              <StatusPill tone="neutral">{t.student.filterPending}</StatusPill>
            )}
            <StatusPill tone="neutral">
              {t.grading.outOf.replace("{max}", n(assignment.maxMarks))}
            </StatusPill>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 text-xs text-muted-foreground">
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

          <span className="inline-flex items-center gap-1.5 tabular">
            <Clock className="size-3.5" aria-hidden />
            {n(Math.max(1, Math.round(words / 220)))} min read
          </span>
        </div>
      </div>

      {readOnly ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground text-pretty">
            This submission has been graded, so it is no longer editable. You can
            still read it below.
          </p>
        </div>
      ) : null}

      <AssignmentEditor
        submissionId={submission?.id ?? null}
        draftKey={draftKey}
        initialContentJson={session?.contentJson ?? null}
        initialText={session?.plainText ?? ""}
        startSequence={session?.lastSequence ?? 0}
        baseOffsetMs={session?.lastOffsetMs ?? 0}
        readOnly={readOnly}
        onStateChange={(state) => setWords(state.words)}
        onEditorReady={(editor, recorder) => {
          editorRef.current = editor;
          recorderRef.current = recorder;
        }}
      />

      {/* Actions sit below the document, out of the writing path. */}
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          {submission ? (
            <VersionHistory
              submissionId={submission.id}
              onRestored={() => router.refresh()}
            />
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            title="Opens the browser's print dialogue, which can save as PDF"
          >
            <Printer className="size-3.5" aria-hidden />
            Print / PDF
          </Button>

          <Button
            onClick={() => setConfirmSubmit(true)}
            disabled={submitting || words === 0}
            className="ms-auto"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {submission ? t.student.updateSubmission : t.student.submit}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        title={submission ? t.student.updateSubmission : t.student.submit}
        description={`${n(words)} words will be submitted for “${assignment.title}”.${
          assignment.allowResubmission
            ? " You can still revise it before the deadline."
            : " This assignment does not allow changes afterwards."
        }`}
        confirmLabel={submission ? t.student.updateSubmission : t.student.submit}
        // Submitting is not destructive; the red treatment is for actions that
        // lose something.
        destructive={false}
        onConfirm={submit}
      />
    </div>
  );
}
