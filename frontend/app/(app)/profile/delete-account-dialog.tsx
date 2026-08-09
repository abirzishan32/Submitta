"use client";

import { useRouter } from "next/navigation";
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

/**
 * The sentence a student has to type to close their own account.
 *
 * Deliberately not a translation key. The backend checks this exact English
 * string — translating it here would ask a Bangla-reading student to type
 * something the API would then reject, which is worse than leaving one
 * sentence untranslated. Everything explaining what to do with it is
 * translated normally; the literal text they must reproduce is not.
 */
const CONFIRMATION_PHRASE = "I want to delete my account";

/**
 * Closes the signed-in student's own account.
 *
 * Two confirmations stacked deliberately: the password is the actual security
 * check — proof this is the account's owner, not a hijacked tab left open on a
 * shared computer. The typed sentence is not security at all; it exists so
 * that deleting an account takes a considered sentence rather than a single
 * misplaced click. Only rendered for students — see `profile-view.tsx`.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const schema = z.object({
    password: z.string().min(1, t.validation.required),
    confirmation: z
      .string()
      .refine((value) => value.trim() === CONFIRMATION_PHRASE, {
        message: t.profile.deleteAccountConfirmMismatch,
      }),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmation: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      await apiClient.post("/api/v1/student/account/delete", values);

      toast.success(t.profile.deleteAccountSuccess);

      // The account no longer exists, so there is no session left to hold —
      // clear the cookies and leave for a page that does not assume one.
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch (error) {
      form.setError("password", {
        message: error instanceof ClientApiError ? error.message : t.errors.generic,
      });
    }
  }

  const { isSubmitting } = form.formState;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset({ password: "", confirmation: "" });
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.profile.deleteAccountDialogTitle}</DialogTitle>
          <DialogDescription className="text-pretty">
            {t.profile.deleteAccountDialogDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            id="delete-account-password"
            label={t.auth.currentPassword}
            error={form.formState.errors.password?.message}
          >
            <Input
              id="delete-account-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              {...form.register("password")}
            />
          </FormField>

          <FormField
            id="delete-account-confirmation"
            label={t.profile.deleteAccountConfirmLabel}
            error={form.formState.errors.confirmation?.message}
          >
            <code className="block rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs select-all">
              {CONFIRMATION_PHRASE}
            </code>
            <Input
              id="delete-account-confirmation"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              {...form.register("confirmation")}
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
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {t.profile.deleteAccount}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
