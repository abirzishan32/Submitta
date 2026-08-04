"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Save, Send } from "lucide-react";
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
import { FadeInUp } from "@/components/motion/primitives";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import type { AssignmentDetail, OfferingOption } from "@/lib/api/types";

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

  const schema = z.object({
    title: z.string().trim().min(1, t.validation.required).max(200),
    description: z.string().trim().min(1, t.validation.required).max(10_000),
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
      description: assignment?.description ?? "",
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

    try {
      if (isEdit && assignment) {
        await apiClient.put(`/api/v1/assignments/${assignment.id}`, {
          title: values.title,
          description: values.description,
          deadline,
          maxMarks: values.maxMarks,
          allowResubmission: values.allowResubmission,
          allowLateSubmission: values.allowLateSubmission,
        });

        toast.success(t.assignments.saved);
        router.push(`${basePath}/assignments/${assignment.id}`);
      } else {
        const created = await apiClient.post<AssignmentDetail>("/api/v1/assignments", {
          title: values.title,
          description: values.description,
          classSubjectId: values.classSubjectId,
          deadline,
          maxMarks: values.maxMarks,
          allowResubmission: values.allowResubmission,
          allowLateSubmission: values.allowLateSubmission,
          publishImmediately: intent === "publish",
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

            <FormField
              id="description"
              label={t.assignments.description}
              error={form.formState.errors.description?.message}
            >
              <Textarea
                id="description"
                rows={8}
                className="resize-y leading-relaxed"
                placeholder="What should students do, and how will it be marked?"
                {...form.register("description")}
              />
            </FormField>

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

              <FormField
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
            </div>

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
