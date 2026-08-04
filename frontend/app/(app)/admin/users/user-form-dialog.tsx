"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/common/form-field";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import type { UserDto, UserRole } from "@/lib/api/types";

/**
 * Create or edit a user.
 *
 * One dialog for both, because the fields are the same bar the password —
 * which only exists at creation, since changing one afterwards goes through the
 * separate reset flow that also revokes sessions.
 */
export function UserFormDialog({
  open,
  user,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  user: UserDto | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = user !== null;

  const schema = z.object({
    fullName: z.string().trim().min(1, t.validation.required).max(150),
    email: z.string().trim().min(1, t.validation.required).email(t.validation.email),
    role: z.enum(["Admin", "Teacher", "Student"]),
    password: isEdit
      ? z.string().optional()
      : z
          .string()
          .min(8, t.validation.minLength.replace("{min}", "8"))
          .regex(/[A-Z]/, t.validation.passwordUppercase)
          .regex(/[a-z]/, t.validation.passwordLowercase)
          .regex(/[0-9]/, t.validation.passwordDigit),
  });

  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", role: "Student", password: "" },
  });

  // Reset when the dialog opens, so a previous edit never leaks into the next.
  useEffect(() => {
    if (!open) return;

    form.reset({
      fullName: user?.fullName ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "Student",
      password: "",
    });
  }, [open, user, form]);

  async function onSubmit(values: Values) {
    try {
      if (isEdit && user) {
        await apiClient.put(`/api/v1/admin/users/${user.id}`, {
          fullName: values.fullName,
          email: values.email,
          role: values.role,
        });
        toast.success(t.users.updated);
      } else {
        await apiClient.post("/api/v1/admin/users", values);
        toast.success(t.users.created);
      }

      onOpenChange(false);
      onSaved();
    } catch (error) {
      if (error instanceof ClientApiError) {
        // Field errors land on the matching input; the rest on the email field,
        // which is what a conflict almost always concerns.
        const fields = error.fieldErrors;

        if (fields.length > 0) {
          for (const { field, message } of fields) {
            form.setError(field as keyof Values, { message });
          }
        } else {
          form.setError("email", { message: error.message });
        }
      } else {
        toast.error(t.errors.generic);
      }
    }
  }

  const { isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t.users.editUser : t.users.newUser}</DialogTitle>
          <DialogDescription>{t.users.subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            id="fullName"
            label={t.users.fullName}
            error={form.formState.errors.fullName?.message}
          >
            <Input id="fullName" autoFocus {...form.register("fullName")} />
          </FormField>

          <FormField
            id="email"
            label={t.users.email}
            error={form.formState.errors.email?.message}
          >
            <Input id="email" type="email" {...form.register("email")} />
          </FormField>

          <FormField
            id="role"
            label={t.users.role}
            error={form.formState.errors.role?.message}
            hint={isEdit ? t.users.teaching : undefined}
          >
            <Select
              value={form.watch("role")}
              onValueChange={(value) =>
                form.setValue("role", value as UserRole, { shouldValidate: true })
              }
            >
              <SelectTrigger id="role" className="w-full">
                <SelectValue>
                  {(value: unknown) => t.roles[(value as UserRole) ?? "Student"]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(["Admin", "Teacher", "Student"] as UserRole[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t.roles[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {!isEdit ? (
            <FormField
              id="password"
              label={t.auth.password}
              error={form.formState.errors.password?.message}
              hint={t.validation.minLength.replace("{min}", "8")}
            >
              <Input id="password" type="password" {...form.register("password")} />
            </FormField>
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
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {isEdit ? t.common.save : t.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
