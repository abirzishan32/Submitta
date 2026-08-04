"use client";

import { useState, type ComponentProps } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Eye, EyeOff, GraduationCap } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useTranslation } from "@/components/providers/i18n-provider";
import { DURATION, EASE } from "@/components/motion/primitives";

/**
 * The shell shared by sign-in and sign-up.
 *
 * A two-column split: the form sits at a comfortable reading width on the right
 * while the left panel carries the product's identity. A single centred form on
 * a wide screen reads as an unfinished page.
 *
 * Shared rather than duplicated so the two pages cannot drift apart — a sign-up
 * page that looks subtly unlike the sign-in page reads as a phishing attempt.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  width = "22rem",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** Sign-up carries more fields, so it is allowed to be wider. */
  width?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen">
      <BrandPanel />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-4 py-4 sm:px-6 lg:justify-end">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold">{t.common.appName}</span>
          </div>

          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE }}
            className="w-full"
            style={{ maxWidth: width }}
          >
            <div className="space-y-1.5 pb-6">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground text-pretty">{subtitle}</p>
            </div>

            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

/**
 * The left-hand identity panel.
 *
 * Typographic rather than illustrated: three plain sentences describing what the
 * system does for each role, which suits an institutional tool better than a
 * hero graphic. The gradient is one very soft wash behind the text, not a focal
 * point of its own.
 */
function BrandPanel() {
  const { t } = useTranslation();

  const points = [t.auth.panelPointOne, t.auth.panelPointTwo, t.auth.panelPointThree];

  return (
    <aside className="relative hidden w-[46%] max-w-2xl shrink-0 flex-col overflow-hidden border-e border-border bg-sidebar px-10 py-9 lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(38rem_26rem_at_15%_10%,var(--sidebar-accent),transparent_62%)] opacity-70"
      />

      <div className="relative flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap className="size-4.5" aria-hidden />
        </span>
        <span className="text-sm font-semibold">{t.common.appName}</span>
      </div>

      {/* Optically centred rather than mathematically: a block of text centred
          on the exact midpoint reads as sitting slightly low. */}
      <div className="relative flex flex-1 flex-col justify-center py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
          className="max-w-md space-y-7"
        >
          <h2 className="text-[2rem] font-semibold leading-[1.15] tracking-tight text-balance">
            {t.auth.panelHeadline}
          </h2>

          <ul className="space-y-3.5">
            {points.map((point, index) => (
              <motion.li
                key={point}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: DURATION.slow,
                  ease: EASE,
                  delay: 0.12 + index * 0.07,
                }}
                className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground text-pretty"
              >
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-sidebar-primary"
                  aria-hidden
                />
                {point}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>

      <p className="relative text-xs text-muted-foreground/70">{t.auth.panelFooter}</p>
    </aside>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

/**
 * A password field with its own reveal toggle.
 *
 * The visibility state lives in the component rather than the page, so a form
 * with two password fields reveals them independently — sharing one flag would
 * expose the confirmation as soon as the first is shown.
 */
export function PasswordInput({
  invalid,
  ...props
}: ComponentProps<typeof Input> & { invalid?: boolean }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        aria-invalid={invalid}
        className="h-10 pe-10"
      />

      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
