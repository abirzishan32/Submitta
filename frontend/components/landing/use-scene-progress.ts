"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll position through a pinned section, as 0 → 1.
 *
 * Deliberately a ref rather than state. The sequence is sampled inside the
 * render loop at 60fps; routing that through React would re-render the tree on
 * every frame to change numbers that only the GPU consumes. Components that
 * genuinely need to re-render (the overlay copy) subscribe separately and at a
 * much coarser granularity.
 *
 * Velocity is tracked alongside position because several effects are keyed to
 * how fast the page is moving rather than where it is — pages fan out further
 * under a hard flick than under a slow drag, which is how paper behaves.
 */
export interface SceneProgress {
  /** 0 before the section is reached, 1 once it has been scrolled past. */
  current: number;
  /** Change per second, signed. */
  velocity: number;
}

export function useSceneProgress(target: React.RefObject<HTMLElement | null>) {
  const progress = useRef<SceneProgress>({ current: 0, velocity: 0 });

  useEffect(() => {
    const element = target.current;
    if (!element) return;

    let lastValue = 0;
    let lastTime = performance.now();
    let frame = 0;
    let running = true;

    const measure = () => {
      if (!running) return;

      const rect = element.getBoundingClientRect();
      // The section is pinned for (height - viewport) pixels; that span is the
      // whole timeline.
      const travel = rect.height - window.innerHeight;
      const value = travel <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / travel));

      const now = performance.now();
      const dt = Math.max(1, now - lastTime) / 1000;

      progress.current.current = value;
      progress.current.velocity = (value - lastValue) / dt;

      lastValue = value;
      lastTime = now;

      frame = requestAnimationFrame(measure);
    };

    // Only sample while the section is on screen. Off screen the numbers cannot
    // affect anything visible, and a landing page should not hold a rAF loop
    // open while the reader is three sections further down.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          lastTime = performance.now();
          frame = requestAnimationFrame(measure);
        } else if (!entry.isIntersecting) {
          running = false;
          cancelAnimationFrame(frame);
          // Settle to whichever end was left, so re-entering does not animate
          // from a stale midpoint.
          progress.current.velocity = 0;
        }
      },
      { rootMargin: "10% 0px" },
    );

    observer.observe(element);
    frame = requestAnimationFrame(measure);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [target]);

  return progress;
}

// --- scene timeline ------------------------------------------------------

/**
 * Where each beat of the sequence sits on the 0 → 1 timeline.
 *
 * Kept in one place so the camera, the cover, the pages and the overlay copy are
 * all reading from the same score instead of each carrying its own magic numbers.
 */
export const SCENE = {
  /** Closed on the desk, establishing the object. */
  intro: [0.0, 0.14],
  /** Cover lifts, camera dollies in. */
  opening: [0.12, 0.32],
  /** First pages turn, settling on the working spread. */
  turning: [0.30, 0.44],
  /** The assignment is written. */
  writing: [0.42, 0.86],
  /** Camera pulls back off the finished page. */
  resolve: [0.86, 1.0],
} as const;

/** Normalised 0 → 1 position within a named beat. */
export function beat(progress: number, range: readonly [number, number]): number {
  const [from, to] = range;
  if (progress <= from) return 0;
  if (progress >= to) return 1;
  return (progress - from) / (to - from);
}

/** Smoothstep, for beats that should ease in and out of their own span. */
export function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
