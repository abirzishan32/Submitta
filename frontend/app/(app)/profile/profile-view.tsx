"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/common/page-header";
import { FormField } from "@/components/common/form-field";
import { StatusPill } from "@/components/common/status-badge";
import { FadeInUp } from "@/components/motion/primitives";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatRelative, initialsOf } from "@/lib/format";
import type { UserProfile } from "@/lib/api/types";

export function ProfileView({ profile }: { profile: UserProfile }) {
  const { t, locale } = useTranslation();
  const router = useRouter();

  const [signingOutAll, setSigningOutAll] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const schema = z
    .object({
      currentPassword: z.string().min(1, t.validation.required),
      newPassword: z
        .string()
        .min(8, t.validation.minLength.replace("{min}", "8"))
        .regex(/[A-Z]/, t.validation.passwordUppercase)
        .regex(/[a-z]/, t.validation.passwordLowercase)
        .regex(/[0-9]/, t.validation.passwordDigit),
      confirmPassword: z.string().min(1, t.validation.required),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      message: t.validation.passwordMatch,
      path: ["confirmPassword"],
    });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function changePassword(values: z.infer<typeof schema>) {
    try {
      await apiClient.post("/api/v1/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      toast.success(t.auth.passwordChanged);

      // Changing a password revokes every session, this one included.
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      form.setError("currentPassword", {
        message: error instanceof ClientApiError ? error.message : t.errors.generic,
      });
    }
  }

  async function signOutEverywhere() {
    setSigningOutAll(true);

    try {
      await apiClient.post("/api/v1/auth/logout-all");
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success(t.auth.signedOut);
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error(t.errors.generic);
      setSigningOutAll(false);
    }
  }

  const { isSubmitting } = form.formState;

  return (
    <div className="space-y-5">
      <PageHeader title={t.profile.title} description={t.profile.subtitle} />

      <div className="grid max-w-4xl gap-6 lg:grid-cols-5">
        <FadeInUp className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
                {initialsOf(profile.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{profile.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t.users.role}</dt>
                <dd>
                  <StatusPill tone="info">{t.roles[profile.role]}</StatusPill>
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t.common.status}</dt>
                <dd>
                  <StatusPill tone={profile.isActive ? "success" : "neutral"}>
                    {profile.isActive ? t.users.active : t.users.inactive}
                  </StatusPill>
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t.users.lastLogin}</dt>
                <dd className="tabular text-xs text-muted-foreground">
                  {profile.lastLoginAt
                    ? formatRelative(profile.lastLoginAt, locale)
                    : t.users.neverLoggedIn}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card p-5">
            <div>
              <p className="text-sm font-medium">{t.settings.appearance}</p>
              <p className="text-xs text-muted-foreground">{t.settings.appearanceHint}</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{t.settings.theme}</span>
              <ThemeToggle />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{t.settings.language}</span>
              <LanguageSwitcher />
            </div>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.06} className="space-y-4 lg:col-span-3">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-1.5 pb-4">
              <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-sm font-semibold">{t.profile.security}</h2>
            </div>

            <form
              onSubmit={form.handleSubmit(changePassword)}
              className="space-y-4"
              noValidate
            >
              <FormField
                id="currentPassword"
                label={t.auth.currentPassword}
                error={form.formState.errors.currentPassword?.message}
              >
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  {...form.register("currentPassword")}
                />
              </FormField>

              <FormField
                id="newPassword"
                label={t.auth.newPassword}
                error={form.formState.errors.newPassword?.message}
              >
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  {...form.register("newPassword")}
                />
              </FormField>

              <FormField
                id="confirmPassword"
                label={t.auth.confirmPassword}
                error={form.formState.errors.confirmPassword?.message}
              >
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  {...form.register("confirmPassword")}
                />
              </FormField>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {t.auth.changePassword}
              </Button>
            </form>

            <Separator className="my-5" />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.auth.signOutEverywhere}</p>
                <p className="text-xs text-muted-foreground">
                  {t.users.resetPasswordHint}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={signOutEverywhere}
                disabled={signingOutAll}
              >
                {signingOutAll ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <LogOut className="size-3.5" aria-hidden />
                )}
                {t.nav.signOut}
              </Button>
            </div>
          </div>

          {/* Only a student may close their own account — a teacher or
              administrator's absence would strand the classes and work that
              depend on them, so that path only exists through an admin who can
              weigh what else needs to happen first. */}
          {profile.role === "Student" ? (
            <div className="rounded-lg border border-destructive/25 bg-card p-5">
              <div className="flex items-center gap-1.5 pb-4">
                <Trash2 className="size-4 text-destructive" aria-hidden />
                <h2 className="text-sm font-semibold text-destructive">
                  {t.profile.dangerZone}
                </h2>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.profile.deleteAccount}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.profile.deleteAccountHint}
                  </p>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t.profile.deleteAccount}
                </Button>
              </div>
            </div>
          ) : null}
        </FadeInUp>
      </div>

      <DeleteAccountDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} />
    </div>
  );
}
