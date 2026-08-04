"use client";

import { motion } from "motion/react";
import {
  CalendarClock,
  Eye,
  MessageSquareQuote,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/common/status-badge";
import { Section, SectionHeading, Reveal } from "./section";
import { StudentStateMockup } from "./app-mockup";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Features.
 *
 * Alternating rows rather than a grid of identical cards. Each row gets a
 * demonstration on one side, which means the feature can be *shown* — a rule
 * about deadlines is far more convincing as the message a student actually sees
 * than as a bullet claiming it exists.
 */
export function Features() {
  return (
    <Section id="features">
      <SectionHeading
        eyebrow="Features"
        title="The rules live in the system, not in someone's memory"
        description="Most coursework tools store files and leave the policy to whoever is
          administering it. Submitta enforces it — which is what makes the
          answer to “can I still submit?” the same every time."
      />

      <div className="space-y-16 pt-14 sm:space-y-24 sm:pt-20">
        <FeatureRow
          icon={Eye}
          title="Drafts stay invisible"
          body="Write an assignment over several sittings and publish when it is
            ready. Until then students cannot see it, cannot open it by URL, and
            cannot submit to it — the API returns “not found”, because confirming
            that it exists would already be a disclosure."
          demo={<DraftDemo />}
        />

        <FeatureRow
          reverse
          icon={CalendarClock}
          title="Deadlines that hold"
          body="A first submission after the deadline is refused unless the
            assignment accepts late work — and is then flagged, with the student
            warned before they submit. Lateness is recorded at the moment of
            submission, so moving a deadline afterwards can never make someone
            retroactively late."
          demo={<StudentStateMockup />}
        />

        <FeatureRow
          icon={MessageSquareQuote}
          title="Feedback keeps its history"
          body="Returning work for revision withdraws the mark but keeps every
            comment, each one snapshotting the marks that stood when it was
            written. A grade → return → regrade cycle reads as a conversation
            rather than overwriting itself."
          demo={<FeedbackDemo />}
        />

        <FeatureRow
          reverse
          icon={ShieldCheck}
          title="Access scoped to the person"
          body="A teacher reaches only the classes they are assigned to; a student
            only their own work. That is decided from the signed token on every
            request — never from anything the browser claims — so hiding a button
            is a courtesy, not the control."
          demo={<AccessDemo />}
        />
      </div>
    </Section>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  body,
  demo,
  reverse,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  demo: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <Reveal className={cn(reverse && "lg:order-2")}>
        <span className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card">
          <Icon className="size-4 text-primary" aria-hidden />
        </span>

        <h3 className="pt-4 text-xl font-semibold tracking-tight text-balance">
          {title}
        </h3>

        <p className="max-w-lg pt-3 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
          {body}
        </p>
      </Reveal>

      <Reveal delay={0.08} className={cn(reverse && "lg:order-1")}>
        {demo}
      </Reveal>
    </div>
  );
}

/** A draft as the teacher sees it, next to what the student sees: nothing. */
function DraftDemo() {
  return (
    <div aria-hidden className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-3.5">
        <p className="text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
          Teacher
        </p>
        <div className="pt-2.5">
          <p className="text-[0.8125rem] font-medium leading-tight">
            Trigonometry Worksheet
          </p>
          <div className="pt-2">
            <StatusPill tone="neutral">Draft</StatusPill>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border/80 p-3.5">
        <p className="text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
          Student
        </p>
        <div className="flex h-[4.25rem] items-center">
          <p className="text-[0.75rem] text-muted-foreground/70">
            Not in the list. Not found by URL.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Two rounds of feedback, the first still carrying the mark it was written against. */
function FeedbackDemo() {
  const entries = [
    { author: "Sarah Ahmed", marks: "60", body: "Method is right but Q7 is unfinished. Returning for revision." },
    { author: "Sarah Ahmed", marks: "80", body: "Much better — the working is complete now." },
  ];

  return (
    <div aria-hidden className="space-y-2.5">
      {entries.map((entry, index) => (
        <motion.div
          key={entry.marks}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ delay: index * 0.12, duration: 0.45, ease: EASE }}
          className="rounded-xl border border-border bg-card p-3.5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[0.75rem] font-medium">{entry.author}</p>
            <p className="shrink-0 text-[0.6875rem] text-muted-foreground tabular">
              marks at the time · {entry.marks}
            </p>
          </div>
          <p className="pt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
            {entry.body}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

/** Who can reach what, stated plainly. */
function AccessDemo() {
  const rows = [
    { who: "Sarah — teaches G10-A", target: "G10-A · Mathematics", allowed: true },
    { who: "Sarah — teaches G10-A", target: "CSE-3101 · Databases", allowed: false },
    { who: "Nadia — enrolled G10-A", target: "Her own submission", allowed: true },
    { who: "Nadia — enrolled G10-A", target: "Tanvir's submission", allowed: false },
  ];

  return (
    <div aria-hidden className="overflow-hidden rounded-xl border border-border bg-card">
      {rows.map((row, index) => (
        <motion.div
          key={`${row.who}-${row.target}`}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ delay: index * 0.07, duration: 0.35 }}
          className={cn(
            "flex items-center gap-3 px-3.5 py-2.5",
            index > 0 && "border-t border-border",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.75rem] text-muted-foreground">{row.who}</p>
            <p className="truncate text-[0.8125rem] font-medium leading-tight">
              {row.target}
            </p>
          </div>

          <StatusPill tone={row.allowed ? "success" : "danger"} className="shrink-0">
            {row.allowed ? "200" : "404"}
          </StatusPill>
        </motion.div>
      ))}
    </div>
  );
}
