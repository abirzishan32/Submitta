"use client";

import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { KeyRound, Lock, ScrollText, TestTube2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Section, SectionHeading, Reveal } from "./section";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Trust.
 *
 * Deliberately not testimonials or user counts. This is a system that holds
 * students' grades, and what earns trust in that is what it guarantees and how
 * that is verified — claims a reader can check in the repository, rather than
 * opinions attributed to people they cannot.
 */

const METRICS = [
  { value: 86, suffix: "", label: "Automated tests", detail: "Authorization, deadlines, grading" },
  { value: 44, suffix: "", label: "API endpoints", detail: "Documented in Swagger" },
  { value: 5, suffix: "", label: "Database constraints", detail: "Rules the schema itself enforces" },
  { value: 2, suffix: "", label: "Languages", detail: "English and Bangla, numerals included" },
] as const;

const GUARANTEES = [
  {
    icon: KeyRound,
    title: "Authorization decided server-side",
    body: "Every request re-derives the caller's role from a signed token. Hiding a control in the interface is a convenience; the API is the boundary.",
  },
  {
    icon: Lock,
    title: "Passwords never stored",
    body: "BCrypt with a per-password salt, and refresh tokens held only as hashes — a leaked database yields no usable sessions.",
  },
  {
    icon: ScrollText,
    title: "Nothing is truly deleted",
    body: "Deletes are rewritten as soft deletes and filtered from every read, so a graded submission cannot be destroyed by a mis-click.",
  },
  {
    icon: TestTube2,
    title: "The rules are tested",
    body: "Deadline, duplicate-submission, marks-bounds and cross-teacher access rules each have tests that fail if the rule is removed.",
  },
] as const;

export function Trust() {
  return (
    <Section id="security" className="border-t border-border/60">
      <SectionHeading
        eyebrow="Trust"
        title="Built to be checked, not taken on faith"
        description="Coursework systems hold something students cannot easily replace.
          These are the properties this one guarantees — each one verifiable in
          the source rather than asserted here."
      />

      <Reveal className="pt-12">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
          {METRICS.map((metric, index) => (
            <div key={metric.label} className="bg-background p-5">
              <dd className="text-3xl font-semibold tabular leading-none">
                <CountUp to={metric.value} delay={index * 0.08} />
                {metric.suffix}
              </dd>
              <dt className="pt-2 text-sm font-medium">{metric.label}</dt>
              <p className="pt-1 text-xs text-muted-foreground text-pretty">
                {metric.detail}
              </p>
            </div>
          ))}
        </dl>
      </Reveal>

      <div className="grid gap-x-10 gap-y-8 pt-14 sm:grid-cols-2">
        {GUARANTEES.map((item, index) => {
          const Icon = item.icon;

          return (
            <Reveal key={item.title} delay={index * 0.06}>
              <div className="flex gap-3.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                  <Icon className="size-3.5 text-primary" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[0.9375rem] font-semibold leading-tight">
                    {item.title}
                  </h3>
                  <p className="pt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {item.body}
                  </p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * Counts to a number when scrolled into view.
 *
 * Eased rather than linear, so it decelerates into the final value instead of
 * stopping dead, and it settles in well under a second — a statistic that takes
 * three seconds to become readable is an obstacle, not an effect.
 */
function CountUp({ to, delay = 0 }: { to: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;

    // Respect a reduced-motion preference by jumping straight to the value.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }

    let frame = 0;
    const duration = 700;
    let start: number | null = null;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setValue(Math.round(to * eased));

      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    timeout = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delay * 1000);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [inView, to, delay]);

  return <span ref={ref}>{value}</span>;
}

/**
 * The stack, as plain wordmarks.
 *
 * Real technologies rather than placeholder partner logos — inventing customer
 * badges for a system with no customers would undermine the section above it.
 */
export function StackStrip() {
  const stack = [
    "ASP.NET Core 9",
    "PostgreSQL",
    "Next.js 16",
    "TypeScript",
    "EF Core",
    "Tailwind CSS",
  ];

  return (
    <Section id="stack" className="border-t border-border/60 py-14 sm:py-16">
      <Reveal>
        <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Built with
        </p>

        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-6 sm:gap-x-12">
          {stack.map((name, index) => (
            <motion.li
              key={name}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.4, ease: EASE }}
              className={cn(
                "text-sm font-medium text-muted-foreground/70 transition-colors duration-200",
                "hover:text-foreground",
              )}
            >
              {name}
            </motion.li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}
