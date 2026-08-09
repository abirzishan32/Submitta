"use client";

import { useEffect, useState } from "react";

/**
 * What this device can reasonably be asked to render.
 *
 * The cinematic sequence is the centrepiece of the page, but it is not the page:
 * the copy, the product and the call to action have to work on a locked-down
 * browser, a machine with no GPU, and for someone who has asked their system to
 * stop animating things. So capability is decided once, up front, and the page
 * commits to a composition rather than degrading feature by feature.
 */
export type Tier = "full" | "reduced" | "static";

export interface Capability {
  tier: Tier;
  /** Resolved after mount; SSR renders the static composition first. */
  ready: boolean;
}

/**
 * WebGL2 support, tested by actually acquiring a context rather than sniffing.
 *
 * The context is disposed immediately — holding a spare one costs a GPU context
 * on machines that only allow a handful.
 */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");

    if (!gl) return false;

    // Software rasterisers report WebGL but render the scene at a few frames a
    // second. They are better served by the static composition.
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : "";

    gl.getExtension("WEBGL_lose_context")?.loseContext();

    return !/swiftshader|llvmpipe|software/i.test(renderer);
  } catch {
    return false;
  }
}

export function useCapability(): Capability {
  const [state, setState] = useState<Capability>({
    tier: "static",
    ready: false,
  });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const resolve = () => {
      if (reduced.matches || !hasWebGL()) {
        setState({ tier: "static", ready: true });
        return;
      }

      // Coarse pointer plus few cores is the honest signal for a phone that will
      // thermally throttle: it still gets the notebook, with fewer page meshes
      // and a smaller texture budget.
      const cores = navigator.hardwareConcurrency ?? 4;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const small = window.innerWidth < 768;

      setState({
        tier: cores <= 4 || (coarse && small) ? "reduced" : "full",
        ready: true,
      });
    };

    resolve();
    reduced.addEventListener("change", resolve);

    return () => reduced.removeEventListener("change", resolve);
  }, []);

  return state;
}

/** Page meshes, texture size and shadow budget per tier. */
export const BUDGET = {
  full: { pages: 14, texture: 2048, shadows: true, dpr: [1, 2] as [number, number] },
  reduced: { pages: 7, texture: 1024, shadows: false, dpr: [1, 1.5] as [number, number] },
  static: { pages: 0, texture: 0, shadows: false, dpr: [1, 1] as [number, number] },
} as const;
