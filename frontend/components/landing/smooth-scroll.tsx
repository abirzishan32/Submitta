"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Smooth scrolling for the landing page only.
 *
 * The cinematic sequence is scrubbed by scroll position, and a native wheel
 * event moves in coarse jumps — roughly 100px per notch — which would make the
 * notebook open in visible steps. Lenis interpolates between those jumps so the
 * sequence is sampled continuously.
 *
 * It is deliberately scoped to this page rather than the app: hijacking scroll
 * inside a grading queue would be hostile, and the signed-in surfaces need the
 * browser's own scrolling for keyboard and accessibility behaviour.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Someone who has asked for less motion gets the browser's scrolling
    // untouched — smoothing is itself motion they did not ask for.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.05,
      // Gentle exponential settle: fast to respond, slow to stop, no overshoot.
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      // Touch devices keep their native inertia, which is better tuned than
      // anything reimplemented here and avoids fighting the OS.
      syncTouch: false,
    });

    let frame = 0;

    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };

    frame = requestAnimationFrame(raf);

    /**
     * Anchor links have to go through Lenis.
     *
     * A native `#` jump sets scroll position directly, which Lenis then treats
     * as an external change and animates back from — the page lurches to the
     * section and slides partway back. Handing the target to Lenis instead makes
     * the jump part of the same motion model as everything else.
     */
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      const href = anchor?.getAttribute("href");

      if (!href || !href.startsWith("#") || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -72, duration: 1.1 });
      // Keep the URL honest so the link is still shareable and the back button
      // behaves.
      history.pushState(null, "", href);
    };

    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
