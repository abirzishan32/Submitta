"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus, Save } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/common/form-field";
import { Label } from "@/components/ui/label";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatRelative } from "@/lib/format";
import type { SubmissionDetail, SubmissionStatus } from "@/lib/api/types";

/**
 * Awarding a mark, with feedback and a status change.
 *
 * Extracted so the same controls serve the grading page and the drawer inside
 * the replay workspace — a teacher who has just watched how something was
 * written should be able to mark it there and then, without losing the replay
 * or re-reading the work. Two copies of a form that writes marks would be two
 * places for the validation to drift.
 */
export function MarkingPanel({
  submission,
  className,
  onGraded,
}: {
  submission: SubmissionDetail;
  className?: string;
  onGraded?: () => void;
}) {
  const { t, tx, locale, n } = useTranslation();
  const router = useRouter();

  const [marks, setMarks] = useState<string>(
    submission.marks !== null ? String(submission.marks) : "",
  );
  const [feedback, setFeedback] = useState("");

  // One score per criterion, keyed by id, for a rubric-marked assignment.
  const [scores, setScores] = useState<Record<string, { points: string; comment: string }>>(
    () =>
      Object.fromEntries(
        submission.rubric.map((c) => [
          c.id,
          { points: c.points?.toString() ?? "", comment: c.comment ?? "" },
        ]),
      ),
  );

  const isRubric = submission.gradingType === "Rubric";
  const isPassFail = submission.gradingType === "PassFail";

  const rubricTotal = submission.rubric.reduce(
    (sum, c) => sum + (Number(scores[c.id]?.points) || 0),
    0,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const parsedMarks = Number(marks);

  const everyCriterionScored = submission.rubric.every((c) => {
    const raw = scores[c.id]?.points ?? "";
    const value = Number(raw);
    return raw.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= c.maxPoints;
  });

  const marksValid = isRubric
    ? submission.rubric.length > 0 && everyCriterionScored
    : marks.trim() !== "" &&
      Number.isFinite(parsedMarks) &&
      parsedMarks >= 0 &&
      parsedMarks <= submission.maxMarks;

  async function grade() {
    if (!marksValid) {
      setError(tx(t.grading.outOf, { max: n(submission.maxMarks) }));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiClient.post(`/api/v1/grading/submissions/${submission.id}/grade`, {
        // For a rubric the API derives the total from the criteria and ignores
        // this figure, so there is no second source of truth to disagree.
        marks: isRubric ? 0 : parsedMarks,
        feedback: feedback.trim() || null,
        criterionScores: isRubric
          ? submission.rubric.map((c) => ({
              criterionId: c.id,
              points: Number(scores[c.id]?.points) || 0,
              comment: scores[c.id]?.comment?.trim() || null,
            }))
          : null,
      });

      toast.success(t.grading.graded);
      setFeedback("");
      router.refresh();
      onGraded?.();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t.errors.generic);
    } finally {
      setSaving(false);
    }
  }

  async function addFeedbackOnly() {
    if (!feedback.trim()) return;

    setSaving(true);
    setError(null);

    try {
      await apiClient.post(`/api/v1/grading/submissions/${submission.id}/feedback`, {
        comment: feedback.trim(),
      });

      toast.success(t.grading.feedbackAdded);
      setFeedback("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t.errors.generic);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(next: SubmissionStatus) {
    setChangingStatus(true);
    setError(null);

    try {
      await apiClient.patch(`/api/v1/grading/submissions/${submission.id}/status`, {
        status: next,
        comment: feedback.trim() || null,
      });

      toast.success(t.grading.statusChanged);
      setFeedback("");
      router.refresh();
    } catch (err) {
      // Moving to Graded without marks is refused by the API, with its reason.
      setError(err instanceof ClientApiError ? err.message : t.errors.generic);
    } finally {
      setChangingStatus(false);
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        {/* The control follows the scheme. A pass/fail decision typed into a
            number box, or a rubric total typed by hand, would both invite a
            result the assignment does not allow. */}
        {isRubric ? (
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label>Rubric</Label>
              <span className="text-xs tabular">
                <span className="font-semibold">{n(rubricTotal)}</span>
                <span className="text-muted-foreground"> / {n(submission.maxMarks)}</span>
              </span>
            </div>

            <ol className="space-y-2">
              {submission.rubric.map((criterion) => {
                const entry = scores[criterion.id] ?? { points: "", comment: "" };
                const value = Number(entry.points);
                const over = entry.points.trim() !== "" && value > criterion.maxPoints;

                return (
                  <li
                    key={criterion.id}
                    className="space-y-1.5 rounded-lg border border-border p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{criterion.title}</p>
                        {criterion.description ? (
                          <p className="pt-0.5 text-xs text-muted-foreground text-pretty">
                            {criterion.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Input
                          aria-label={`Marks for ${criterion.title}`}
                          type="number"
                          min={0}
                          max={criterion.maxPoints}
                          step="0.5"
                          value={entry.points}
                          onChange={(event) =>
                            setScores((current) => ({
                              ...current,
                              [criterion.id]: { ...entry, points: event.target.value },
                            }))
                          }
                          aria-invalid={over}
                          className="h-8 w-16 tabular"
                        />
                        <span className="text-xs text-muted-foreground tabular">
                          / {n(criterion.maxPoints)}
                        </span>
                      </div>
                    </div>

                    <Input
                      aria-label={`Comment on ${criterion.title}`}
                      placeholder="Note on this criterion (optional)"
                      value={entry.comment}
                      onChange={(event) =>
                        setScores((current) => ({
                          ...current,
                          [criterion.id]: { ...entry, comment: event.target.value },
                        }))
                      }
                      className="h-8 text-xs"
                    />
                  </li>
                );
              })}
            </ol>
          </div>
        ) : isPassFail ? (
          <div className="space-y-1.5">
            <Label>{t.grading.marks}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={marks === "1" ? "default" : "outline"}
                onClick={() => setMarks("1")}
              >
                Pass
              </Button>
              <Button
                type="button"
                variant={marks === "0" ? "destructive" : "outline"}
                onClick={() => setMarks("0")}
              >
                Fail
              </Button>
            </div>
          </div>
        ) : (
          <FormField
            id="marks"
            label={t.grading.marks}
            hint={
              submission.gradingType === "Percentage"
                ? "Out of 100"
                : tx(t.grading.outOf, { max: n(submission.maxMarks) })
            }
          >
            <div className="flex items-center gap-2">
              <Input
                id="marks"
                type="number"
                min={0}
                max={submission.maxMarks}
                step="0.5"
                value={marks}
                onChange={(event) => setMarks(event.target.value)}
                className="tabular"
              />
              <span className="shrink-0 text-sm text-muted-foreground tabular">
                {submission.gradingType === "Percentage" ? "%" : `/ ${n(submission.maxMarks)}`}
              </span>
            </div>
          </FormField>
        )}

        <FormField id="feedback" label={t.grading.feedback} optional>
          <Textarea
            id="feedback"
            rows={5}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder={t.grading.feedbackPlaceholder}
            className="resize-y leading-relaxed"
          />
        </FormField>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button onClick={grade} disabled={saving || changingStatus || !marksValid}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {submission.status === "Graded" ? t.grading.regrade : t.grading.grade}
          </Button>

          <Button
            variant="outline"
            onClick={addFeedbackOnly}
            disabled={saving || changingStatus || !feedback.trim()}
          >
            <MessageSquarePlus className="size-4" aria-hidden />
            {t.grading.addFeedback}
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        <FormField id="status" label={t.grading.changeStatus}>
          <Select
            value={submission.status}
            onValueChange={(value) => changeStatus(value as SubmissionStatus)}
          >
            <SelectTrigger id="status" className="w-full" disabled={changingStatus}>
              <SelectValue>
                {(value: unknown) =>
                  t.submissionStatus[(value as SubmissionStatus) ?? "Submitted"]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(
                ["Submitted", "UnderReview", "Graded", "ReturnedForRevision"] as SubmissionStatus[]
              ).map((value) => (
                <SelectItem key={value} value={value}>
                  {t.submissionStatus[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {submission.gradedByTeacherName && submission.gradedAt ? (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">
              {tx(t.grading.gradedBy, { name: submission.gradedByTeacherName })} ·{" "}
              {formatRelative(submission.gradedAt, locale)}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
