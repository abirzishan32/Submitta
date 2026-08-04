"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "./section";

/**
 * Closing call to action.
 *
 * A single bordered panel rather than a full-bleed coloured band — the page has
 * been restrained throughout and ending on a saturated slab would read as a
 * different site. The demo credentials are stated outright because the fastest
 * way to be convinced is to be inside the product.
 */
export function FinalCta() {
  return (
    <section className="px-5 pb-24 pt-6 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-14 text-center sm:px-12 sm:py-20">
            {/* One soft wash behind the text, anchored off-centre so it reads as
                light falling across the panel rather than as a glow. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(38rem_20rem_at_50%_-20%,var(--accent),transparent_70%)]"
            />

            <div className="relative mx-auto max-w-xl">
              <h2 className="text-2xl font-semibold leading-tight tracking-tight text-balance sm:text-3xl">
                Try it as an administrator, a teacher, or a student
              </h2>

              <p className="pt-4 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
                Three demo accounts are ready on the sign-in page — one click
                fills the form. Sign in as one teacher and you will find you
                cannot reach another&rsquo;s class, which is the whole point.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-8">
                <MagneticButton>
                  <Button size="lg" render={<Link href="/login" />} className="h-10 px-5">
                    Get started
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                </MagneticButton>

                <Button
                  size="lg"
                  variant="outline"
                  render={<a href="#features" />}
                  className="h-10 px-5"
                >
                  Read the features
                </Button>
              </div>

              <p className="pt-6 font-[family-name:var(--font-mono-code)] text-xs text-muted-foreground">
                admin@school.edu · Demo@1234
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Nudges its child a few pixels toward the cursor.
 *
 * Capped at 6px and disabled under reduced motion — enough to feel responsive
 * on approach, not enough to make the target move away from someone aiming at
 * it. Pointer-driven only, so it never fires on touch.
 */
function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  function handleMove(event: React.PointerEvent<HTMLSpanElement>) {
    if (reduceMotion || event.pointerType !== "mouse") return;

    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);

    el.style.transform = `translate(${clamp(x * 0.18)}px, ${clamp(y * 0.18)}px)`;
  }

  function reset() {
    if (ref.current) ref.current.style.transform = "";
  }

  return (
    <motion.span
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      className="inline-block transition-transform duration-200 ease-[var(--ease-out-quint)]"
    >
      {children}
    </motion.span>
  );
}

function clamp(value: number, limit = 6): number {
  return Math.max(-limit, Math.min(limit, value));
}
