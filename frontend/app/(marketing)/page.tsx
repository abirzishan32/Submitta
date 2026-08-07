import type { Metadata } from "next";

import { Hero } from "@/components/marketing/hero";
import { Showcase } from "@/components/marketing/showcase";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Trust, StackStrip } from "@/components/marketing/trust";
import { FinalCta } from "@/components/marketing/final-cta";

export const metadata: Metadata = {
  title: { absolute: "Submitta" },
  description:
    "Assignment and submission management for schools and colleges. Teachers publish work to a class and subject, students submit and revise before the deadline, and marks and feedback come back in the same place.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Showcase />
      <Features />
      <HowItWorks />
      <Trust />
      <StackStrip />
      <FinalCta />
    </>
  );
}
