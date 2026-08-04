"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "motion/react";
import { CheckCircle2, GraduationCap, Loader2, Lock, UserRound } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthLayout, FieldError, PasswordInput } from "@/components/auth/auth-layout";
import { useTranslation } from "@/components/providers/i18n-provider";
import { DURATION } from "@/components/motion/primitives";
import { homeFor } from "@/lib/navigation";
import type { UserProfile } from "@/lib/api/types";
import type { RegistrationOptions } from "./page";

/** Matches the API's rules, so the form refuses what the server would refuse. */
const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

const NO_CLASS = "none";

export function RegisterView({ options }: { options: RegistrationOptions }) {
  const { t } = useTranslation();
  const router = useRouter();

  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const schema = z
    .object({
      fullName: z.string().trim().min(2, t.validation.required).max(150),
      email: z.string().min(1, t.validation.required).email(t.validation.email),
      password: z.string().regex(PASSWORD, t.auth.passwordRules),
      confirmPassword: z.string().min(1, t.validation.required),
      role: z.enum(["Student", "Teacher"]),
      classId: z.string(),
    })
    .refine((values) => values.password === values.confirmPassword, {
      path: ["confirmPassword"],
      message: t.validation.passwordMatch,
    });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "Student",
      classId: NO_CLASS,
    },
  });

  const { isSubmitting } = form.formState;
  const role = form.watch("role");

  async function onSubmit(values: z.infer<typeof schema>) {
    setFormError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          password: values.password,
          confirmPassword: values.confirmPassword,
          role: values.role,
          // Only meaningful for a student; the API ignores it otherwise.
          classId:
            values.role === "Student" && values.classId !== NO_CLASS
              ? values.classId
              : null,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setFormError(payload?.message ?? t.errors.generic);
        return;
      }

      if (payload.data.requiresApproval) {
        setPending(true);
        return;
      }

      const user = payload.data.user as UserProfile;
      toast.success(t.dashboard.welcome.replace("{name}", user.fullName));

      router.replace(homeFor(user.role));
      router.refresh();
    } catch {
      setFormError(t.errors.network);
    }
  }

  // --- Closed ------------------------------------------------------------

  if (!options.selfRegistrationEnabled) {
    return (
      <AuthLayout title={t.auth.registrationClosed} subtitle={t.auth.registrationClosedHint}>
        <Button render={<Link href="/login" />} className="h-10 w-full">
          {t.auth.signIn}
        </Button>
      </AuthLayout>
    );
  }

  // --- Awaiting approval -------------------------------------------------

  if (pending) {
    return (
      <AuthLayout title={t.auth.pendingApprovalTitle} subtitle={t.auth.pendingApprovalBody}>
        <div className="flex items-start gap-2.5 rounded-lg border border-success/30 bg-success/8 p-3.5">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <p className="text-sm text-muted-foreground text-pretty">
            {form.getValues("email")}
          </p>
        </div>

        <Button render={<Link href="/login" />} className="mt-4 h-10 w-full">
          {t.auth.signIn}
        </Button>
      </AuthLayout>
    );
  }

  // --- The form ----------------------------------------------------------

  return (
    <AuthLayout
      title={t.auth.createAccountTitle}
      subtitle={t.auth.createAccountSubtitle}
      width="26rem"
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Role first: it changes what the rest of the form asks for. */}
        {options.teacherRegistrationEnabled ? (
          <fieldset className="space-y-1.5">
            <legend className="pb-1.5 text-sm font-medium">{t.auth.iAmA}</legend>

            <div className="grid grid-cols-2 gap-2">
              <RoleCard
                icon={GraduationCap}
                label={t.roles.Student}
                description={t.auth.panelPointTwo}
                selected={role === "Student"}
                onSelect={() => form.setValue("role", "Student")}
              />
              <RoleCard
                icon={UserRound}
                label={t.roles.Teacher}
                description={t.auth.panelPointOne}
                selected={role === "Teacher"}
                onSelect={() => form.setValue("role", "Teacher")}
              />
            </div>
          </fieldset>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="fullName">{t.auth.fullName}</Label>
          <Input
            id="fullName"
            autoComplete="name"
            autoFocus
            placeholder={t.auth.fullNamePlaceholder}
            aria-invalid={Boolean(form.formState.errors.fullName)}
            className="h-10"
            {...form.register("fullName")}
          />
          <FieldError message={form.formState.errors.fullName?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">{t.auth.email}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t.auth.emailPlaceholder}
            aria-invalid={Boolean(form.formState.errors.email)}
            className="h-10"
            {...form.register("email")}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        {role === "Student" && options.classes.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="classId">{t.auth.joinClass}</Label>
            <Select
              value={form.watch("classId")}
              onValueChange={(value) => form.setValue("classId", value as string)}
            >
              <SelectTrigger id="classId" className="h-10 w-full">
                <SelectValue>
                  {(value: unknown) =>
                    value === NO_CLASS || !value
                      ? t.auth.joinClassNone
                      : (options.classes.find((c) => c.id === value)?.name ??
                        t.auth.joinClassNone)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CLASS}>{t.auth.joinClassNone}</SelectItem>
                {options.classes.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name} · {option.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground text-pretty">
              {t.auth.joinClassHint}
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="password">{t.auth.password}</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder={t.auth.passwordPlaceholder}
            invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          <FieldError message={form.formState.errors.password?.message} />
          {!form.formState.errors.password ? (
            <p className="text-xs text-muted-foreground text-pretty">
              {t.auth.passwordRules}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">{t.auth.confirmPasswordSignUp}</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder={t.auth.passwordPlaceholder}
            invalid={Boolean(form.formState.errors.confirmPassword)}
            {...form.register("confirmPassword")}
          />
          <FieldError message={form.formState.errors.confirmPassword?.message} />
        </div>

        {role === "Teacher" && options.teacherRequiresApproval ? (
          <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground text-pretty">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t.auth.pendingApprovalBody}
          </p>
        ) : null}

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
              {t.auth.creatingAccount}
            </>
          ) : (
            t.auth.createAccount
          )}
        </Button>
      </form>

      <p className="pt-5 text-center text-sm text-muted-foreground">
        {t.auth.haveAccount}{" "}
        <Link
          href="/login"
          className="font-medium text-primary transition-opacity hover:opacity-70"
        >
          {t.auth.signIn}
        </Link>
      </p>
    </AuthLayout>
  );
}

function RoleCard({
  icon: Icon,
  label,
  description,
  selected,
  onSelect,
}: {
  icon: typeof GraduationCap;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3 text-start transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-input hover:bg-accent/40",
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        <Icon className="size-4" aria-hidden />
        {label}
      </span>
      <span className="line-clamp-2 text-xs text-muted-foreground">{description}</span>
    </button>
  );
}
