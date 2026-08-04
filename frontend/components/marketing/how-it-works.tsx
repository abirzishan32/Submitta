"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { CheckSquare, GraduationCap, Send, Users } from "lucide-react";

import { Section, SectionHeading } from "./section";

const EASE = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    icon: Users,
    role: "Administrator",
    title: "Set up the term",
    body: "Create classes and subjects, decide which subjects each class is taught, assign teachers to them, and enrol students.",
  },
  {
    icon: GraduationCap,
    role: "Teacher",
    title: "Publish the work",
    body: "Write the assignment, set a deadline and a mark scheme, choose whether revisions and late work are allowed — then publish, or keep it as a draft.",
  },
  {
    icon: Send,
    role: "Student",
    title: "Submit and revise",
    body: "The assignment appears for the right class only. Submit an answer, revise it before the deadline where allowed, and see exactly why if you cannot.",
  },
  {
    icon: CheckSquare,
    role: "Teacher",
    title: "Mark and return",
    body: "Read submissions alongside the list of who has not submitted. Award marks with feedback, or send work back for another attempt.",
  },
] as const;

/**
 * How it works.
 *
 * A vertical timeline whose connecting line draws itself as the section
 * scrolls, so progress through the steps maps to progress down the page. The
 * line is a scaled element rather than an SVG path, which keeps it on the
 * compositor.
 */
export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    // Starts drawing when the list reaches three-quarters up the viewport and
    // finishes at the midpoint, so it completes while the steps are still read.
    offset: ["start 0.75", "end 0.5"],
  });

  // Springing the raw progress stops the line jittering on a trackpad.
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    restDelta: 0.001,
  });

  const scaleY = useTransform(progress, [0, 1], [0, 1]);

  return (
    <Section id="how-it-works" className="border-t border-border/60">
      <SectionHeading
        eyebrow="How it works"
        title="Four steps, and the term runs itself"
        description="Each role does its part in one place, and the handover between them
          is the product rather than an email."
      />

      <div ref={ref} className="relative pt-14 sm:pt-20">
        {/* Rail — sits behind the markers, inset to their centre. */}
        <div
          aria-hidden
          className="absolute bottom-6 left-[1.1875rem] top-16 w-px bg-border sm:top-22"
        />
        <motion.div
          aria-hidden
          style={{ scaleY }}
          className="absolute bottom-6 left-[1.1875rem] top-16 w-px origin-top bg-primary sm:top-22"
        />

        <ol className="space-y-10 sm:space-y-12">
          {STEPS.map((step, index) => {
            const Icon = step.icon;

            return (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="relative flex gap-5"
              >
                <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                  <Icon className="size-4 text-primary" aria-hidden />
                </span>

                <div className="min-w-0 pt-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {step.title}
                    </h3>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                      {step.role}
                    </span>
                  </div>

                  <p className="max-w-xl pt-2 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
                    {step.body}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}
