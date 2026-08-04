"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, CheckboxField } from "@/components/common/form-field";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import type { SubjectDto } from "@/lib/api/types";

export function SubjectFormDialog({
  open,
  entity,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  entity: SubjectDto | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = entity !== null;

  const schema = z.object({
    name: z.string().trim().min(1, t.validation.required).max(150),
    code: z
      .string()
      .trim()
      .min(1, t.validation.required)
      .max(50)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, t.validation.required),
    description: z.string().trim().max(1000).optional(),
    isActive: z.boolean(),
  });

  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", code: "", description: "", isActive: true },
  });

  useEffect(() => {
    if (!open) return;

    form.reset({
      name: entity?.name ?? "",
      code: entity?.code ?? "",
      description: entity?.description ?? "",
      isActive: entity?.isActive ?? true,
    });
  }, [open, entity, form]);

  async function onSubmit(values: Values) {
    const body = {
      name: values.name,
      code: values.code,
      description: values.description || null,
      ...(isEdit ? { isActive: values.isActive } : {}),
    };

    try {
      if (isEdit && entity) {
        await apiClient.put(`/api/v1/admin/subjects/${entity.id}`, body);
        toast.success(t.subjects.updated);
      } else {
        await apiClient.post("/api/v1/admin/subjects", body);
        toast.success(t.subjects.created);
      }

      onOpenChange(false);
      onSaved();
    } catch (error) {
      if (error instanceof ClientApiError) {
        const fields = error.fieldErrors;

        if (fields.length > 0) {
          for (const { field, message } of fields) {
            form.setError(field as keyof Values, { message });
          }
        } else {
          form.setError("code", { message: error.message });
        }
      } else {
        toast.error(t.errors.generic);
      }
    }
  }

  const { isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t.subjects.editSubject : t.subjects.newSubject}
          </DialogTitle>
          <DialogDescription>{t.subjects.subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="name"
              label={t.subjects.name}
              error={form.formState.errors.name?.message}
            >
              <Input id="name" autoFocus placeholder="Mathematics" {...form.register("name")} />
            </FormField>

            <FormField
              id="code"
              label={t.subjects.code}
              error={form.formState.errors.code?.message}
            >
              <Input
                id="code"
                placeholder="MATH"
                className="font-[family-name:var(--font-mono-code)]"
                {...form.register("code")}
              />
            </FormField>
          </div>

          <FormField
            id="description"
            label={t.subjects.description}
            optional
            error={form.formState.errors.description?.message}
          >
            <Textarea id="description" rows={3} className="resize-y" {...form.register("description")} />
          </FormField>

          {isEdit ? (
            <CheckboxField
              id="isActive"
              label={t.users.active}
              hint={t.subjects.subtitle}
              checked={form.watch("isActive")}
              onChange={(checked) => form.setValue("isActive", checked)}
            />
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {isEdit ? t.common.save : t.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
