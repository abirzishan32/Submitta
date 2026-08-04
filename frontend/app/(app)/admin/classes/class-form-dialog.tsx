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
import type { ClassDto } from "@/lib/api/types";

export function ClassFormDialog({
  open,
  entity,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  entity: ClassDto | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = entity !== null;

  const schema = z.object({
    name: z.string().trim().min(1, t.validation.required).max(150),
    // Mirrors the API's rule: codes appear in URLs and search, so they are
    // restricted to characters that survive both unescaped.
    code: z
      .string()
      .trim()
      .min(1, t.validation.required)
      .max(50)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, t.validation.required),
    description: z.string().trim().max(1000).optional(),
    academicYear: z.string().trim().max(20).optional(),
    isActive: z.boolean(),
  });

  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      academicYear: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;

    form.reset({
      name: entity?.name ?? "",
      code: entity?.code ?? "",
      description: entity?.description ?? "",
      academicYear: entity?.academicYear ?? "",
      isActive: entity?.isActive ?? true,
    });
  }, [open, entity, form]);

  async function onSubmit(values: Values) {
    const body = {
      name: values.name,
      code: values.code,
      description: values.description || null,
      academicYear: values.academicYear || null,
      ...(isEdit ? { isActive: values.isActive } : {}),
    };

    try {
      if (isEdit && entity) {
        await apiClient.put(`/api/v1/admin/classes/${entity.id}`, body);
        toast.success(t.classes.updated);
      } else {
        await apiClient.post("/api/v1/admin/classes", body);
        toast.success(t.classes.created);
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
          // A duplicate code is the usual conflict, so point at that field.
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
          <DialogTitle>{isEdit ? t.classes.editClass : t.classes.newClass}</DialogTitle>
          <DialogDescription>{t.classes.subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="name"
              label={t.classes.name}
              error={form.formState.errors.name?.message}
            >
              <Input id="name" autoFocus placeholder="Grade 10 - Section A" {...form.register("name")} />
            </FormField>

            <FormField
              id="code"
              label={t.classes.code}
              error={form.formState.errors.code?.message}
            >
              <Input
                id="code"
                placeholder="G10-A"
                className="font-[family-name:var(--font-mono-code)]"
                {...form.register("code")}
              />
            </FormField>
          </div>

          <FormField
            id="academicYear"
            label={t.classes.academicYear}
            optional
            error={form.formState.errors.academicYear?.message}
          >
            <Input id="academicYear" placeholder="2025-2026" {...form.register("academicYear")} />
          </FormField>

          <FormField
            id="description"
            label={t.classes.description}
            optional
            error={form.formState.errors.description?.message}
          >
            <Textarea id="description" rows={3} className="resize-y" {...form.register("description")} />
          </FormField>

          {isEdit ? (
            <CheckboxField
              id="isActive"
              label={t.users.active}
              hint={t.classes.subtitle}
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
