"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";

import {
  AssignmentListMockup,
  GradingMockup,
  StudentStateMockup,
} from "@/components/marketing/app-mockup";

/**
 * Everything after the sequence.
 *
 * The page comes up out of the dark studio into paper: the sections below are
 * laid out like a printed specification — hairline rules, a strict measure,
 * numbered steps, wide margins — rather than as cards floating on a gradient.
 * The physical idea carries on; it just stops being three-dimensional.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Reveals on first sight, once, and not at all under reduced motion. */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });
  const still = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={still ? false : { opacity: 0, y: 18 }}
      animate={inView || still ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Small caps label with a rule, used to open each section. */
function SectionMark({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-foreground/10 pb-4">
      <span className="font-[family-name:var(--font-mono-code)] text-[0.7rem] tracking-[0.2em] text-muted-foreground">
        {index}
      </span>
      <span className="text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

// --- capability ----------------------------------------------------------

const CAPABILITIES = [
  {
    title: "Work belongs to a class and a subject",
    body: "An assignment is published against one offering. Every student enrolled in that class sees it; nobody else does — and that is enforced by the API, not by hiding a link.",
  },
  {
    title: "Drafts stay unpublished",
    body: "Write it over a week if you like. Until it is published it exists for its author alone, and the deadline cannot be set in the past once it is live.",
  },
  {
    title: "The deadline is a rule",
    body: "Late submission and revision are each a switch on the assignment. A student sees exactly why a button is disabled, because the server decided it and said so.",
  },
  {
    title: "Marks cannot exceed the maximum",
    body: "Marking is validated against the assignment it belongs to, whether it is a single figure, a pass, or a rubric that totals its own criteria.",
  },
  {
    title: "Nothing is destroyed to tidy a list",
    body: "Once work has been submitted, its assignment can be archived but not deleted. Marks and feedback outlive convenience.",
  },
  {
    title: "Every revision kept",
    body: "Submissions are edited in place with their history intact, so \"which version did they hand in\" always has an answer.",
  },
] as const;

function Capability() {
  return (
    <section id="features" className="scroll-mt-20 bg-[#faf8f4] px-6 py-28 text-foreground sm:px-10 lg:py-36 dark:bg-[#101318]">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionMark index="01">What it enforces</SectionMark>
        </Reveal>

        <Reveal delay={0.05}>
          <h2 className="mt-10 max-w-2xl font-[family-name:var(--font-display)] text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.04] tracking-[-0.02em]">
            Rules that hold when nobody is watching.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-x-14 gap-y-12 sm:grid-cols-2">
          {CAPABILITIES.map((item, index) => (
            <Reveal key={item.title} delay={0.04 * index}>
              <article className="border-t border-foreground/10 pt-6">
                <h3 className="text-[1.02rem] font-medium leading-snug tracking-[-0.01em]">
                  {item.title}
                </h3>
                <p className="mt-3 text-[0.92rem] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- workflow ------------------------------------------------------------

const STEPS = [
  { n: "01", name: "Brief", body: "A teacher writes the assignment against a class and subject, with a deadline and a maximum." },
  { n: "02", name: "Publish", body: "It becomes visible to the students enrolled in that class, and to nobody else." },
  { n: "03", name: "Write", body: "Students draft their answer, revise it, and submit before the deadline closes." },
  { n: "04", name: "Mark", body: "The teacher reviews the work, awards marks within the maximum, and writes feedback." },
  { n: "05", name: "Return", body: "Marks and feedback land against the same submission. Or it goes back for revision." },
] as const;

function Workflow() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y border-foreground/10 bg-background px-6 py-28 sm:px-10 lg:py-36">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionMark index="02">The route a piece of work takes</SectionMark>
        </Reveal>

        <ol className="mt-14">
          {STEPS.map((step, index) => (
            <Reveal key={step.n} delay={0.04 * index}>
              <li className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 border-b border-foreground/10 py-7 sm:grid-cols-[5rem_10rem_1fr] sm:gap-x-10">
                <span className="font-[family-name:var(--font-mono-code)] text-[0.72rem] tracking-[0.16em] text-muted-foreground">
                  {step.n}
                </span>
                <h3 className="font-[family-name:var(--font-display)] text-xl tracking-[-0.01em] sm:text-2xl">
                  {step.name}
                </h3>
                <p className="col-span-2 mt-2 max-w-xl text-[0.92rem] leading-relaxed text-muted-foreground sm:col-span-1 sm:mt-0">
                  {step.body}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

// --- product -------------------------------------------------------------

/**
 * The real interface.
 *
 * After a sequence of rendered paper, it matters that the actual product is
 * shown plainly and without decoration — the notebook was the metaphor, this is
 * the thing being sold.
 */
function Product() {
  return (
    <section id="product" className="scroll-mt-20 bg-[#faf8f4] px-6 py-28 sm:px-10 lg:py-36 dark:bg-[#101318]">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionMark index="03">The interface</SectionMark>
        </Reveal>

        <Reveal delay={0.05}>
          <h2 className="mt-10 max-w-2xl font-[family-name:var(--font-display)] text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.04] tracking-[-0.02em]">
            Three roles, three views, one record.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {[
            { caption: "Teacher — assignments", node: <AssignmentListMockup /> },
            { caption: "Teacher — marking", node: <GradingMockup /> },
            { caption: "Student — my work", node: <StudentStateMockup /> },
          ].map((item, index) => (
            <Reveal key={item.caption} delay={0.06 * index}>
              <figure>
                <div className="overflow-hidden rounded-lg border border-foreground/10 bg-card shadow-[0_20px_45px_-28px_rgba(0,0,0,0.45)]">
                  {item.node}
                </div>
                <figcaption className="mt-4 font-[family-name:var(--font-mono-code)] text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                  {item.caption}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- close ---------------------------------------------------------------

function Close() {
  return (
    <section id="start" className="scroll-mt-20 relative overflow-hidden bg-[#0b0d11] px-6 py-32 text-[#f4f1ea] sm:px-10 lg:py-44">
      {/* One raking light, echoing the studio the page opened in. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 55% at 24% 12%, rgba(255,232,198,0.12) 0%, transparent 62%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(2.4rem,6vw,4.6rem)] leading-[1.02] tracking-[-0.02em]">
            Your next assignment
            <br />
            starts here.
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="mx-auto mt-7 max-w-md text-[0.95rem] leading-relaxed text-[#f4f1ea]/58">
            Sign in with a demo account and set a piece of work end to end — brief,
            submission, marking, feedback.
          </p>
        </Reveal>

        <Reveal delay={0.14}>
          <div className="mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="group inline-flex h-11 items-center gap-2 rounded-full bg-[#f4f1ea] px-6 text-sm font-medium text-[#0b0d11] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4f1ea]/50"
            >
              Open the demo
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>

            <Link
              href="/register"
              className="inline-flex h-11 items-center rounded-full border border-[#f4f1ea]/22 px-6 text-sm text-[#f4f1ea]/78 transition-colors hover:border-[#f4f1ea]/45 hover:text-[#f4f1ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4f1ea]/40"
            >
              Create an account
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mt-8 font-[family-name:var(--font-mono-code)] text-[0.68rem] uppercase tracking-[0.18em] text-[#f4f1ea]/32">
            admin · teacher · student — all seeded
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingSections() {
  return (
    <>
      <Capability />
      <Workflow />
      <Product />
      <Close />
    </>
  );
}
