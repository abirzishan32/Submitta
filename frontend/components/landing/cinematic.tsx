"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";

import { useCapability } from "./capability";
import { useSceneProgress } from "./use-scene-progress";
import { StaticNotebook } from "./static-notebook";

/**
 * The scroll-driven sequence.
 *
 * A tall section holds the timeline; a sticky viewport-sized stage holds the
 * render. Scrolling the section moves the sequence, which is why the page is
 * 520vh tall — that height is duration, not content.
 *
 * The 3D scene is loaded only after the capability check has passed, so a phone
 * on a slow connection and a browser without WebGL never download Three at all.
 */

const NotebookScene = dynamic(() => import("./notebook-scene"), {
  ssr: false,
  loading: () => null,
});

/** Captions, each owning a slice of the timeline. */
const CAPTIONS = [
  { from: 0.0, to: 0.16, label: "01 — The brief", text: "A teacher sets the work against a class and a subject.", colour: "#fbb000" },
  { from: 0.16, to: 0.36, label: "02 — Open", text: "It reaches every student enrolled, the moment it is published.", colour: "#fbb000" },
  { from: 0.36, to: 0.62, label: "03 — The work", text: "Students write, revise, and submit before the deadline.", colour: "#fbb000" },
  { from: 0.62, to: 0.86, label: "04 — The marking", text: "Marks and feedback come back against the same page.", colour: "#fbb000" },
  { from: 0.86, to: 1.01, label: "05 — On record", text: "Every version kept, nothing lost between inbox and spreadsheet.", colour: "#fbb000" },
] as const;

export function Cinematic({ handwritingFont }: { handwritingFont: string }) {
  const section = useRef<HTMLElement>(null);
  const progress = useSceneProgress(section);
  const capability = useCapability();

  // The captions are the only part of the sequence that re-renders React, and
  // they change five times across the whole scroll — so they read the progress
  // ref on a timer rather than subscribing to every frame.
  const [act, setAct] = useState(0);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      const p = progress.current.current;
      const index = CAPTIONS.findIndex((c) => p >= c.from && p < c.to);
      setAct((prev) => (index >= 0 && index !== prev ? index : prev));
      setEntered(p > 0.04);
    }, 120);

    return () => window.clearInterval(id);
  }, [progress]);

  const caption = CAPTIONS[act];

  return (
    <section
      ref={section}
      className="relative h-[520vh] bg-[#0b0d11]"
      aria-label="How an assignment moves through Submitta"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Stage */}
        <div className="absolute inset-0">
          {/* Narrowed inline rather than through a boolean: the scene only
              accepts the tiers it can actually render. */}
          {capability.ready && capability.tier !== "static" ? (
            <NotebookScene
              progress={progress}
              tier={capability.tier}
              handwritingFont={handwritingFont}
            />
          ) : (
            <StaticNotebook ready={capability.ready} />
          )}
        </div>

        {/* Vignette. Sits over the render to pull the eye to the centre and let
            the type sit on something dark enough to read against. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(125% 95% at 50% 46%, transparent 46%, rgba(6,8,11,0.55) 100%)",
          }}
        />

        {/* Opening title. Holds the frame alone, then clears out of the way of
            the object it is introducing. */}
        {/* Held to the top of the frame and kept small enough that the notebook
            below it is never obscured. The object is the hero; this names it. */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center px-6 pt-[11vh] text-center sm:pt-[13vh]"
          animate={{ opacity: entered ? 0 : 1, y: entered ? -24 : 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1
            className="font-[family-name:var(--font-display)] text-[clamp(2.1rem,5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-[#f4f1ea]"
            style={{ textShadow: "0 2px 30px rgba(6,8,11,0.55)" }}
          >
            Turn ideas into assignments.
          </h1>

          <p
            className="mt-5 max-w-xs text-[0.85rem] leading-relaxed text-[#f4f1ea]/52"
            style={{ textShadow: "0 1px 16px rgba(6,8,11,0.6)" }}
          >
            Assignment and submission management for schools and colleges.
          </p>
        </motion.div>

        {/* Scroll cue, pinned to the bottom so it never lands on the object. */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[4vh]"
          animate={{ opacity: entered ? 0 : 1 }}
          transition={{ duration: 0.5 }}
        >
          <span className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.22em] text-[#f4f1ea]/32">
            <span className="h-px w-6 bg-[#f4f1ea]/22" />
            Scroll
          </span>
        </motion.div>

        {/* Running caption. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-[9vh] sm:px-12">
          <AnimatePresence mode="wait">
            {entered ? (
              <motion.div
                key={act}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <span
                  className="font-[family-name:var(--font-mono-code)] text-[0.68rem] uppercase tracking-[0.2em]"
                  style={{ color: caption.colour, opacity: 0.55 }}
                >
                  {caption.label}
                </span>
                <p
                  className="max-w-md text-balance text-[0.95rem] leading-relaxed sm:text-right"
                  style={{ color: caption.colour, opacity: 0.85 }}
                >
                  {caption.text}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Progress hairline. The only chrome in the sequence — it tells the
            reader how much of the story is left, which a 520vh section owes them. */}
        <ProgressRule progress={progress} />
      </div>
    </section>
  );
}

/** A hairline that fills as the sequence advances, written directly to the DOM. */
function ProgressRule({
  progress,
}: {
  progress: React.RefObject<{ current: number }>;
}) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      if (bar.current) {
        // scaleX on a composited element: no layout, no React, no reflow.
        bar.current.style.transform = `scaleX(${progress.current.current})`;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [progress]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[#f4f1ea]/10"
    >
      <div
        ref={bar}
        className="h-full origin-left bg-[#f4f1ea]/45"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
