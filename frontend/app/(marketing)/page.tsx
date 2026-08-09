import type { Metadata } from "next";
import { Caveat } from "next/font/google";

import { Cinematic } from "@/components/landing/cinematic";
import { LandingSections } from "@/components/landing/sections";

/**
 * The handwriting face, resolved here so its family name can be handed to the
 * canvas painter. `next/font` returns the hashed family it generated, which is
 * the only reliable way to name the font inside a 2D context — a CSS variable
 * means nothing to `ctx.font`.
 */
const hand = Caveat({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { absolute: "Submitta" },
  description:
    "Assignment and submission management for schools and colleges. Teachers publish work to a class and subject, students submit and revise before the deadline, and marks and feedback come back in the same place.",
};

export default function HomePage() {
  return (
    <>
      <Cinematic handwritingFont={hand.style.fontFamily} />
      <LandingSections />
    </>
  );
}
