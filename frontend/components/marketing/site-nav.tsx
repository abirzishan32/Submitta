"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { ArrowRight, GraduationCap, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { homeFor } from "@/lib/navigation";
import type { UserProfile } from "@/lib/api/types";

/**
 * Anchors on the landing page. These must match the section ids in
 * `components/landing/sections.tsx` — a link here with no section to land on is
 * a dead link, which is what happened when the old page was replaced.
 */
const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#product", label: "Interface" },
  { href: "#start", label: "Get the demo" },
] as const;

/**
 * Site navigation.
 *
 * Transparent over the hero, then gains a background, blur and a hairline
 * border once the page scrolls — so the bar reads as part of the hero at rest
 * and as a separate surface in motion. The threshold is 24px rather than 0, so
 * a trackpad's inertial jitter at the very top does not flicker it.
 */
export function SiteNav({ user }: { user: UserProfile | null }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (value) => {
    setScrolled(value > 24);
  });

  // The mobile sheet should not leave the page scrollable behind it.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
          scrolled
            ? "border-b border-border/80 bg-background/80 backdrop-blur-md"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <nav
          aria-label="Main"
          className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5 sm:px-8"
        >
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="size-4" aria-hidden />
            </span>
            <span className="text-[0.9375rem] font-semibold tracking-tight">
              Submitta
            </span>
          </Link>

          <ul className="hidden flex-1 items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="relative rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="ms-auto flex items-center gap-1.5 md:ms-0">
            <ThemeToggle className="hidden sm:inline-flex" />

            {user ? (
              <Button size="sm" render={<Link href={homeFor(user.role)} />}>
                Go to dashboard
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href="/login" />}
                  className="hidden sm:inline-flex"
                >
                  Sign in
                </Button>
                <Button size="sm" render={<Link href="/login" />}>
                  Get started
                </Button>
              </>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-4" aria-hidden />
            </Button>
          </div>
        </nav>
      </header>

      {/* Mobile menu — a plain panel rather than a frosted overlay, so the
          links stay legible against whatever is behind them. */}
      {menuOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-background md:hidden"
        >
          <div className="flex h-16 items-center justify-between px-5">
            <span className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <GraduationCap className="size-4" aria-hidden />
              </span>
              <span className="text-[0.9375rem] font-semibold tracking-tight">
                Submitta
              </span>
            </span>

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>

          <ul className="flex flex-col gap-1 px-4 pt-4">
            {LINKS.map((link, index) => (
              <motion.li
                key={link.href}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 + index * 0.04, duration: 0.2 }}
              >
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-lg font-medium transition-colors hover:bg-accent"
                >
                  {link.label}
                </a>
              </motion.li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-2 border-t border-border px-4 pt-4">
            <ThemeToggle />
          </div>
        </motion.div>
      ) : null}
    </>
  );
}
