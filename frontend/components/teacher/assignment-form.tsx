"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, ClipboardList, Hash, Loader2, Percent, Save, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField, CheckboxField } from "@/components/common/form-field";
import { Label } from "@/components/ui/label";
import { RichText } from "@/components/editor/rich-text";
import { RubricBuilder, type RubricRow } from "./rubric-builder";
import { cn } from "@/lib/utils";
import { FadeInUp } from "@/components/motion/primitives";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import type { AssignmentDetail, GradingType, OfferingOption } from "@/lib/api/types";

/**
 * Create or edit an assignment.
 *
 * A full page rather than a dialog: the description is the substance of the
 * work and deserves room, and a teacher may reasonably spend minutes on it.
 *
 * Creation offers two actions — save as draft, or publish now — because that is
 * genuinely the decision at hand. Publishing requires a future deadline, which
 * the API enforces and which is surfaced here before the request is made.
 */
const GRADING_TYPES: Array<{
  value: GradingType;
  label: string;
  hint: string;
  icon: typeof Hash;
}> = [
  { value: "Points", label: "Points", hint: "A mark out of a total you choose.", icon: Hash },
  { value: "Percentage", label: "Percentage", hint: "A mark out of 100.", icon: Percent },
  { value: "PassFail", label: "Pass / fail", hint: "A decision, not a score.", icon: CheckCircle2 },
  { value: "Rubric", label: "Rubric", hint: "Scored against criteria you write.", icon: ClipboardList },
];

/** What the total will be, for the schemes that decide it rather than the teacher. */
function fixedTotalLabel(type: GradingType, rubric: RubricRow[]): string {
  if (type === "Percentage") return "100 (percentage)";
  if (type === "PassFail") return "Pass or fail";

  const total = rubric.reduce((sum, row) => sum + (Number(row.maxPoints) || 0), 0);
  return `${total} (from the rubric)`;
}

export function AssignmentForm({
  offerings,
  assignment,
  basePath,
}: {
  offerings: OfferingOption[];
  assignment?: AssignmentDetail;
  basePath: string;
}) {
  const { t, n } = useTranslation();
  const router = useRouter();

  const isEdit = assignment !== undefined;
  const [formError, setFormError] = useState<string | null>(null);
  const [intent, setIntent] = useState<"draft" | "publish">("draft");

  const [gradingType, setGradingType] = useState<GradingType>(
    assignment?.gradingType ?? "Points",
  );

  const [rubric, setRubric] = useState<RubricRow[]>(
    assignment?.rubric?.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description ?? "",
      maxPoints: c.maxPoints,
    })) ?? [],
  );

  // Both forms of the brief are kept: the rich document for display, and the
  // flattened text that lists, search and older clients read.
  const [brief, setBrief] = useState({
    json: assignment?.descriptionJson ?? null,
    text: assignment?.description ?? "",
  });

  // Marks already awarded are anchored to the scheme they were given under, so
  // changing it afterwards would make them mean something else.
  const gradingLocked = isEdit && (assignment?.submissionCount ?? 0) > 0;

  const schema = z.object({
    title: z.string().trim().min(1, t.validation.required).max(200),
    classSubjectId: z.string().min(1, t.validation.required),
    deadline: z.string().min(1, t.validation.required),
    // Plain number rather than z.coerce: Zod 4 types a coerced input as
    // `unknown`, which no longer satisfies the resolver. The input is parsed
    // by `valueAsNumber` on registration instead.
    maxMarks: z
      .number({ message: t.validation.positiveNumber })
      .gt(0, t.validation.positiveNumber)
      .max(1000, t.validation.maxLength.replace("{max}", "1000")),
    allowResubmission: z.boolean(),
    allowLateSubmission: z.boolean(),
  });

  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: assignment?.title ?? "",
      classSubjectId: assignment?.classSubjectId ?? offerings[0]?.classSubjectId ?? "",
      // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
      deadline: assignment ? toLocalInput(assignment.deadline) : defaultDeadline(),
      maxMarks: assignment?.maxMarks ?? 100,
      allowResubmission: assignment?.allowResubmission ?? true,
      allowLateSubmission: assignment?.allowLateSubmission ?? false,
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setFormError(null);

    const deadline = new Date(values.deadline).toISOString();

    const written = brief.text.trim();

    if (!written) {
      setFormError("Write the brief — an assignment with no question tells the student nothing.");
      return;
    }

    if (gradingType === "Rubric" && rubric.every((r) => !r.title.trim())) {
      setFormError("A rubric-graded assignment needs at least one criterion.");
      return;
    }

    const grading = {
      gradingType,
      descriptionJson: brief.json,
      rubric:
        gradingType === "Rubric"
          ? rubric
              .filter((r) => r.title.trim())
              .map((r) => ({
                id: r.id ?? null,
                title: r.title.trim(),
                description: r.description.trim() || null,
                maxPoints: Number(r.maxPoints) || 0,
              }))
          : null,
    };

    try {
      if (isEdit && assignment) {
        await apiClient.put(`/api/v1/assignments/${assignment.id}`, {
          title: values.title,
          description: written,
          deadline,
          maxMarks: values.maxMarks,
          allowResubmission: values.allowResubmission,
          allowLateSubmission: values.allowLateSubmission,
          ...grading,
        });

        toast.success(t.assignments.saved);
        router.push(`${basePath}/assignments/${assignment.id}`);
      } else {
        const created = await apiClient.post<AssignmentDetail>("/api/v1/assignments", {
          title: values.title,
          description: written,
          classSubjectId: values.classSubjectId,
          deadline,
          maxMarks: values.maxMarks,
          allowResubmission: values.allowResubmission,
          allowLateSubmission: values.allowLateSubmission,
          publishImmediately: intent === "publish",
          ...grading,
        });

        toast.success(
          intent === "publish" ? t.assignments.published : t.assignments.created,
        );
        router.push(`${basePath}/assignments/${created.id}`);
      }

      router.refresh();
    } catch (error) {
      if (error instanceof ClientApiError) {
        const fields = error.fieldErrors;

        if (fields.length > 0) {
          for (const { field, message } of fields) {
            form.setError(field as keyof Values, { message });
          }
        } else {
          // Business-rule refusals (a past deadline on publish, marks below
          // those already awarded) arrive here with the API's own wording.
          setFormError(error.message);
        }
      } else {
        setFormError(t.errors.generic);
      }
    }
  }

  const backHref = isEdit
    ? `${basePath}/assignments/${assignment.id}`
    : `${basePath}/assignments`;

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={backHref} />}
        className="-ms-2 text-muted-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t.common.back}
      </Button>

      <FadeInUp className="max-w-3xl space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEdit ? t.assignments.editAssignment : t.assignments.newAssignment}
        </h1>
        <p className="text-sm text-muted-foreground">{t.assignments.subtitle}</p>
      </FadeInUp>

      <FadeInUp delay={0.04}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="max-w-3xl space-y-5"
          noValidate
        >
          <div className="space-y-5 rounded-lg border border-border bg-card p-5">
            <FormField
              id="title"
              label={t.assignments.assignmentTitle}
              error={form.formState.errors.title?.message}
            >
              <Input
                id="title"
                autoFocus={!isEdit}
                placeholder="Quadratic Equations Problem Set"
                {...form.register("title")}
              />
            </FormField>

            <div className="space-y-2">
              <div>
                <Label>{t.assignments.description}</Label>
                <p className="pt-0.5 text-xs text-muted-foreground text-pretty">
                  Headings, lists, tables and code all work. Press{" "}
                  <kbd className="rounded border border-border bg-muted px-1 text-[0.6875rem]">/</kbd>{" "}
                  for commands.
                </p>
              </div>

              <RichText
                value={brief.json}
                fallback={assignment?.description}
                editable
                minHeight="14rem"
                placeholder="What should students do, and how will it be marked?"
                onChange={(json, text) => setBrief({ json, text })}
              />
            </div>

            {/* The offering cannot change after creation: existing submissions
                belong to the class it was set for. */}
            <FormField
              id="classSubjectId"
              label={t.assignments.classSubject}
              error={form.formState.errors.classSubjectId?.message}
              hint={isEdit ? undefined : undefined}
            >
              {isEdit && assignment ? (
                <Input
                  id="classSubjectId"
                  value={`${assignment.classCode} · ${assignment.subjectName}`}
                  disabled
                  readOnly
                />
              ) : (
                <Select
                  value={form.watch("classSubjectId")}
                  onValueChange={(value) =>
                    form.setValue("classSubjectId", String(value), {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="classSubjectId" className="w-full">
                    <SelectValue placeholder={t.assignments.classSubject}>
                      {(value: unknown) =>
                        offerings.find((o) => o.classSubjectId === value)?.label ?? ""
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {offerings.map((offering) => (
                      <SelectItem
                        key={offering.classSubjectId}
                        value={offering.classSubjectId}
                      >
                        {offering.label} · {n(offering.enrolledStudentCount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="deadline"
                label={t.assignments.deadline}
                error={form.formState.errors.deadline?.message}
              >
                <Input
                  id="deadline"
                  type="datetime-local"
                  className="tabular"
                  {...form.register("deadline")}
                />
              </FormField>

              {/* The total is only the teacher's to choose for Points. Every
                  other scheme fixes it, so the box is replaced by what it
                  will be rather than left to be contradicted. */}
              {gradingType === "Points" ? (
                <FormField
                  // Keyed so React replaces the field rather than reusing the
                  // input across branches — a reused node keeps the value the
                  // other branch put in it.
                  key="maxMarks-editable"
                  id="maxMarks"
                  label={t.assignments.maxMarks}
                  error={form.formState.errors.maxMarks?.message}
                >
                  <Input
                    id="maxMarks"
                    type="number"
                    min={1}
                    max={1000}
                    step="0.5"
                    className="tabular"
                    {...form.register("maxMarks", { valueAsNumber: true })}
                  />
                </FormField>
              ) : (
                <FormField key="maxMarks-fixed" id="maxMarksFixed" label={t.assignments.maxMarks}>
                  <Input
                    id="maxMarksFixed"
                    value={fixedTotalLabel(gradingType, rubric)}
                    disabled
                    readOnly
                    className="tabular"
                  />
                </FormField>
              )}
            </div>

            {/* How it is marked. Placed after the total because it decides
                whether that total is even editable. */}
            <div className="space-y-2">
              <div>
                <Label>Grading</Label>
                <p className="pt-0.5 text-xs text-muted-foreground text-pretty">
                  {gradingLocked
                    ? "Work has already been submitted, so the grading method is now fixed — marks already given would stop meaning what they say."
                    : "How this work is marked. Students see this before they start."}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {GRADING_TYPES.map(({ value, label, hint, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    disabled={gradingLocked}
                    aria-pressed={gradingType === value}
                    onClick={() => setGradingType(value)}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border p-3 text-start transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      gradingType === value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-input hover:bg-accent/40",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <Icon className="size-3.5" aria-hidden />
                      {label}
                    </span>
                    <span className="text-xs text-muted-foreground text-pretty">{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {gradingType === "Rubric" ? (
              <RubricBuilder rows={rubric} onChange={setRubric} />
            ) : null}

            <div className="grid gap-2.5 sm:grid-cols-2">
              <CheckboxField
                id="allowResubmission"
                label={t.assignments.allowResubmission}
                hint={t.assignments.allowResubmissionHint}
                checked={form.watch("allowResubmission")}
                onChange={(checked) => form.setValue("allowResubmission", checked)}
              />
              <CheckboxField
                id="allowLateSubmission"
                label={t.assignments.allowLateSubmission}
                hint={t.assignments.allowLateSubmissionHint}
                checked={form.watch("allowLateSubmission")}
                onChange={(checked) => form.setValue("allowLateSubmission", checked)}
              />
            </div>
          </div>

          {formError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {isEdit ? (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-4" aria-hidden />
                )}
                {t.common.save}
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setIntent("draft")}
                >
                  {isSubmitting && intent === "draft" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-4" aria-hidden />
                  )}
                  {t.assignments.saveDraft}
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  onClick={() => setIntent("publish")}
                >
                  {isSubmitting && intent === "publish" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="size-4" aria-hidden />
                  )}
                  {t.assignments.publishNow}
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="ghost"
              render={<Link href={backHref} />}
              disabled={isSubmitting}
            >
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </FadeInUp>
    </div>
  );
}

/** ISO instant → the local "YYYY-MM-DDTHH:mm" that datetime-local expects. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** A week out, on the hour — a sensible starting point rather than an empty field. */
function defaultDeadline(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(23, 59, 0, 0);

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
