"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Reveals its children once they are properly on screen.
 *
 * `amount: 0.25` rather than the default, so a tall section animates when a
 * quarter of it is visible instead of the instant its top edge appears — which
 * on a long page means the reveal has usually finished before you reach it.
 * `once` keeps it from replaying on the way back up.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * The heading block each section opens with.
 *
 * An eyebrow, a headline and one sentence — capped at a readable measure and
 * left-aligned by default, because a page where every section centres its text
 * reads as a template.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "start",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          {eyebrow}
        </p>
      ) : null}

      <h2 className="pt-2.5 text-2xl font-semibold leading-tight tracking-tight text-balance sm:text-3xl">
        {title}
      </h2>

      {description ? (
        <p className="pt-3 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}

/** Consistent vertical rhythm and max width for every section on the page. */
export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      // scroll-mt clears the fixed navigation when an anchor link lands here.
      className={cn("scroll-mt-20 px-5 py-20 sm:px-8 sm:py-24", className)}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}
