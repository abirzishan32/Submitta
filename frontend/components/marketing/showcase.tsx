"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

import { cn } from "@/lib/utils";
import { SectionHeading } from "./section";
import { AssignmentListMockup, GradingMockup } from "./app-mockup";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Product showcase.
 *
 * Three panes at different depths, each drifting at its own rate as the section
 * passes — the effect reads as parallax because the layers genuinely move
 * differently, not because anything is faked with a shadow.
 *
 * The whole group also lifts and settles as it enters, which is what makes the
 * panes feel like one object rather than three that happen to be nearby.
 */
export function Showcase() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const factor = reduceMotion ? 0 : 1;

  const backY = useTransform(scrollYProgress, [0, 1], [60 * factor, -60 * factor]);
  const midY = useTransform(scrollYProgress, [0, 1], [30 * factor, -30 * factor]);
  const frontY = useTransform(scrollYProgress, [0, 1], [0, -10 * factor]);

  // Settles from slightly small and slightly tilted as it enters view.
  const scale = useTransform(scrollYProgress, [0, 0.35], [0.96, 1]);
  const rotate = useTransform(scrollYProgress, [0, 0.35], [1.2 * factor, 0]);

  return (
    <section ref={ref} className="overflow-hidden px-5 pb-24 pt-6 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <SectionHeading
          eyebrow="The product"
          title="One place where the work actually lives"
          description="Not a folder of attachments and a spreadsheet of marks. Every
            assignment carries its own deadline, mark scheme and submission
            state, and every view is scoped to the person looking at it."
          align="center"
          className="mx-auto"
        />

        <motion.div
          style={{ scale, rotate }}
          className="relative mx-auto mt-14 max-w-4xl"
        >
          {/* Back — the widest pane, furthest away. */}
          <motion.div
            style={{ y: backY }}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mx-auto w-[92%]"
          >
            <AssignmentListMockup className="opacity-90" />
          </motion.div>

          {/* Middle — offset right, overlapping the pane above. */}
          <motion.div
            style={{ y: midY }}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="relative z-10 -mt-14 ms-auto w-[74%] sm:-mt-20 sm:w-[62%]"
          >
            <GradingMockup />
          </motion.div>

          {/* Front — a single detail, closest to the reader. */}
          <motion.div
            style={{ y: frontY }}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
            className="relative z-20 -mt-10 w-[64%] sm:-mt-14 sm:w-[46%]"
          >
            <NotSubmittedCard />
          </motion.div>

          {/* Fades the stack into the page rather than cutting it off. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -bottom-6 h-32 bg-gradient-to-t from-background to-transparent"
          />
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Who has not submitted.
 *
 * Chosen as the closest pane on purpose: it is the part of the product a
 * teacher actually needs and most tools omit, so it is worth the foreground.
 */
function NotSubmittedCard({ className }: { className?: string }) {
  const names = ["Nadia Islam", "Mim Chowdhury"];

  return (
    <div
      aria-hidden
      className={cn(
        "rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-overlay)]",
        className,
      )}
    >
      <p className="text-[0.6875rem] font-medium text-muted-foreground">
        2 students have not submitted
      </p>

      <div className="flex flex-wrap gap-1.5 pt-2.5">
        {names.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[0.6875rem]"
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-background text-[0.5rem] font-medium">
              {name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </span>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
