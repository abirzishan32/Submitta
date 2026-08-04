"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "motion/react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout, FieldError, PasswordInput } from "@/components/auth/auth-layout";
import { useTranslation } from "@/components/providers/i18n-provider";
import { DURATION } from "@/components/motion/primitives";
import { homeFor } from "@/lib/navigation";
import type { UserProfile, UserRole } from "@/lib/api/types";

/** Seeded accounts, so a reviewer can sign in without reading the README first. */
const DEMO_ACCOUNTS: Array<{ role: UserRole; email: string }> = [
  { role: "Admin", email: "admin@school.edu" },
  { role: "Teacher", email: "sarah.ahmed@school.edu" },
  { role: "Student", email: "nadia.islam@school.edu" },
];

const DEMO_PASSWORD = "Demo@1234";

/**
 * Sign-in.
 *
 * Shares its shell with sign-up, so the two pages cannot drift apart — a
 * sign-up page that looks subtly unlike the sign-in page reads as a phishing
 * attempt.
 */
export function LoginView({
  redirectTo,
  registrationOpen,
}: {
  redirectTo?: string;
  registrationOpen: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({
    email: z.string().min(1, t.validation.required).email(t.validation.email),
    password: z.string().min(1, t.validation.required),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof schema>) {
    setFormError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setFormError(payload?.message ?? t.errors.generic);
        return;
      }

      const user = payload.data.user as UserProfile;
      toast.success(t.dashboard.welcome.replace("{name}", user.fullName));

      router.replace(redirectTo ?? homeFor(user.role));
      // refresh(), so the shell re-reads the new session cookie.
      router.refresh();
    } catch {
      setFormError(t.errors.network);
    }
  }

  function useDemoAccount(email: string) {
    form.setValue("email", email, { shouldValidate: true });
    form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    setFormError(null);
  }

  return (
    <AuthLayout title={t.auth.signInTitle} subtitle={t.auth.signInSubtitle}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t.auth.email}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder={t.auth.emailPlaceholder}
            aria-invalid={Boolean(form.formState.errors.email)}
            className="h-10"
            {...form.register("email")}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t.auth.password}</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder={t.auth.passwordPlaceholder}
            invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </div>

        {formError ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.fast }}
            role="alert"
            className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </motion.p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="h-10 w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t.auth.signingIn}
            </>
          ) : (
            t.auth.signIn
          )}
        </Button>
      </form>

      {registrationOpen ? (
        <p className="pt-5 text-center text-sm text-muted-foreground">
          {t.auth.noAccount}{" "}
          <Link
            href="/register"
            className="font-medium text-primary transition-opacity hover:opacity-70"
          >
            {t.auth.createAccount}
          </Link>
        </p>
      ) : null}

      <div className="mt-8">
        <div className="flex items-center gap-1.5 pb-2">
          <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden />
          <p className="text-xs font-medium">{t.auth.demoAccounts}</p>
          <span className="text-xs text-muted-foreground">· {t.auth.demoHint}</span>
        </div>

        <div className="grid gap-1 rounded-lg border border-border bg-card/50 p-1">
          {DEMO_ACCOUNTS.map(({ role, email }) => (
            <button
              key={email}
              type="button"
              onClick={() => useDemoAccount(email)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-start transition-colors",
                "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            >
              <span className="text-xs font-medium">{t.roles[role]}</span>
              <span className="truncate font-[family-name:var(--font-mono-code)] text-[0.6875rem] text-muted-foreground">
                {email}
              </span>
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
