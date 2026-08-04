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
import { FormField } from "@/components/common/form-field";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import type { UserDto } from "@/lib/api/types";

/**
 * Sets a new password for another account.
 *
 * Separate from the edit dialog because it has a side effect the admin should
 * be conscious of: every session that account holds is revoked.
 */
export function ResetPasswordDialog({
  user,
  onOpenChange,
}: {
  user: UserDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  const schema = z.object({
    newPassword: z
      .string()
      .min(8, t.validation.minLength.replace("{min}", "8"))
      .regex(/[A-Z]/, t.validation.passwordUppercase)
      .regex(/[a-z]/, t.validation.passwordLowercase)
      .regex(/[0-9]/, t.validation.passwordDigit),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "" },
  });

  useEffect(() => {
    if (user) form.reset({ newPassword: "" });
  }, [user, form]);

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!user) return;

    try {
      await apiClient.post(`/api/v1/admin/users/${user.id}/reset-password`, values);
      toast.success(t.auth.passwordChanged);
      onOpenChange(false);
    } catch (error) {
      form.setError("newPassword", {
        message: error instanceof ClientApiError ? error.message : t.errors.generic,
      });
    }
  }

  const { isSubmitting } = form.formState;

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.users.resetPassword}</DialogTitle>
          <DialogDescription className="text-pretty">
            {user?.fullName} · {user?.email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            id="newPassword"
            label={t.auth.newPassword}
            hint={t.users.resetPasswordHint}
            error={form.formState.errors.newPassword?.message}
          >
            <Input
              id="newPassword"
              type="password"
              autoFocus
              autoComplete="new-password"
              {...form.register("newPassword")}
            />
          </FormField>

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
              {t.users.resetPassword}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
