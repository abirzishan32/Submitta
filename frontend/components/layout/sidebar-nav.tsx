"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/providers/i18n-provider";
import { NAVIGATION, isActiveRoute } from "@/lib/navigation";
import type { UserRole } from "@/lib/api/types";

/**
 * Sidebar navigation.
 *
 * The active indicator is a shared layout animation, so moving between items
 * slides one marker rather than cross-fading two — a small thing that makes
 * navigation feel continuous instead of stateless.
 */
export function SidebarNav({
  role,
  onNavigate,
}: {
  role: UserRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav className="flex flex-1 flex-col gap-6 px-3 py-4" aria-label="Main">
      {NAVIGATION[role].map((section, sectionIndex) => (
        <div key={sectionIndex} className="space-y-1">
          {/* The first section is the dashboard link alone; a heading above a
              single item is noise. */}
          {sectionIndex > 0 ? (
            <p className="px-2 pb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/70">
              {section.label(t)}
            </p>
          ) : null}

          {section.items.map((item) => {
            const active = isActiveRoute(pathname, item);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active
                    ? "text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-md bg-sidebar-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    aria-hidden
                  />
                ) : null}

                <Icon
                  className={cn(
                    "relative size-4 shrink-0 transition-colors",
                    active ? "text-sidebar-primary" : "text-muted-foreground/80",
                  )}
                  aria-hidden
                />
                <span className="relative truncate font-medium">{item.label(t)}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
