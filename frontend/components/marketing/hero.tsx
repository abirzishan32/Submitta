"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spotlight } from "@/components/ui/spotlight";
import { AssignmentListMockup, GradingMockup } from "./app-mockup";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Entrance for a hero element, staggered by position.
 *
 * Returned as plain `initial`/`animate`/`transition` props rather than as
 * variants: the copy column is itself a motion element (it carries the parallax
 * transform), and resolving variants through a motion parent that has no
 * variant state of its own left every child stuck in its hidden state.
 */
function rise(index: number) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.06 * index, duration: 0.5, ease: EASE },
  } as const;
}

const PROOF = [
  "No spreadsheets",
  "Deadlines enforced",
  "Marks in one place",
] as const;

/**
 * Hero.
 *
 * Two columns rather than centred text over floating cards: the copy holds the
 * left edge where reading starts, and the product sits beside it doing the
 * explaining. The mockups drift at slightly different rates on scroll, which
 * gives depth without anything sliding around unprompted.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Different rates so the two panes separate as the page moves. Small enough
  // that nothing leaves its container before the section scrolls away.
  const frontY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -56]);
  const backY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -104]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -28]);

  // No scroll-linked opacity here. It measured wrong on first paint — the
  // headline rendered at ~30% before any scrolling — and a hero that arrives
  // faded is a far worse failure than the absence of a fade-out.

  return (
    <section
      ref={ref}
      className="relative flex min-h-svh items-center overflow-hidden pt-16"
    >
      {/* One light source, off to one side, at low opacity. Enough to keep the
          section from reading as a flat slab; not a glow effect. */}
      <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-56"
        fill="var(--color-primary)"
      />

      {/* A hairline grid, masked to fade out — structure rather than decoration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [mask-image:radial-gradient(70%_55%_at_50%_35%,black,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-24">
        <motion.div style={{ y: copyY }} className="max-w-xl">
          <motion.p
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground"
          >
            <span className="size-1.5 rounded-full bg-success" />
            For schools, colleges and universities
          </motion.p>

          <motion.h1
            {...rise(1)}
            className="pt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]"
          >
            Coursework without the chasing.
          </motion.h1>

          <motion.p
            {...rise(2)}
            className="max-w-lg pt-5 text-base leading-relaxed text-muted-foreground text-pretty sm:text-[1.0625rem]"
          >
            Teachers publish work to a class and subject. Students submit and
            revise before the deadline. Marks and feedback come back in the same
            place — with the rules enforced by the system instead of remembered
            by a person.
          </motion.p>

          <motion.div
            {...rise(3)}
            className="flex flex-wrap items-center gap-2.5 pt-7"
          >
            <Button size="lg" render={<Link href="/login" />} className="h-10 px-4">
              Get started
              <ArrowRight className="size-4" aria-hidden />
            </Button>

            <Button
              size="lg"
              variant="outline"
              render={<a href="#how-it-works" />}
              className="h-10 px-4"
            >
              See how it works
            </Button>
          </motion.div>

          <motion.ul
            {...rise(4)}
            className="flex flex-wrap gap-x-5 gap-y-2 pt-7"
          >
            {PROOF.map((item) => (
              <li
                key={item}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Check className="size-3.5 text-success" aria-hidden />
                {item}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        {/* Product. Hidden below `lg`, where two stacked panes would push the
            call to action off the first screen.

            The panes overlap at a corner rather than face-on: the front card is
            anchored below the list's midpoint and pulled left, so it clips the
            bottom-left corner while every row above stays readable. Layering
            that hides the thing it is layered over just looks broken. */}
        <div className="relative hidden pb-28 lg:block">
          <motion.div
            style={{ y: backY }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.6, ease: EASE }}
            className="ms-auto w-[94%]"
          >
            <AssignmentListMockup />
          </motion.div>

          <motion.div
            style={{ y: frontY }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36, duration: 0.6, ease: EASE }}
            className="absolute -left-14 top-[64%] w-[72%]"
          >
            <GradingMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
