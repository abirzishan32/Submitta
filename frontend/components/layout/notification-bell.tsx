"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  ClipboardCheck,
  FilePlus2,
  Inbox,
  Loader2,
  RotateCcw,
  UserCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/components/providers/notification-provider";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatRelative } from "@/lib/format";
import { DURATION, EASE } from "@/components/motion/primitives";
import type { NotificationType } from "@/lib/api/notification-types";

const ICONS: Record<NotificationType, typeof Bell> = {
  AssignmentPublished: FilePlus2,
  DeadlineApproaching: CalendarClock,
  SubmissionReceived: Inbox,
  SubmissionGraded: ClipboardCheck,
  SubmissionReturned: RotateCcw,
  AccountAwaitingApproval: UserCheck,
};

/**
 * The bell, and the list behind it.
 *
 * The badge is driven by the shared provider rather than by its own fetch, so
 * it and the list can never disagree — a count that says three above a list of
 * two is worse than no count at all.
 */
export function NotificationBell() {
  const { t, locale } = useTranslation();
  const { items, unreadCount, connected, loading, markRead, markAllRead } =
    useNotifications();

  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              unreadCount > 0
                ? `${t.notifications.title} (${unreadCount})`
                : t.notifications.title
            }
            className="relative"
          />
        }
      >
        <Bell className="size-4" aria-hidden />

        <AnimatePresence>
          {unreadCount > 0 ? (
            <motion.span
              key="badge"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: DURATION.fast, ease: EASE }}
              className={cn(
                "absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center",
                "rounded-full bg-destructive px-1 text-[0.625rem] font-semibold leading-4",
                "text-destructive-foreground tabular",
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[22rem] p-0">
        <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{t.notifications.title}</h2>

            {/* Only shown when it is down. A live badge saying "live" is noise;
                a quiet one saying "offline" is information. */}
            {!connected && !loading ? (
              <span
                title={t.notifications.offlineHint}
                className="rounded-full bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground"
              >
                {t.notifications.offline}
              </span>
            ) : null}
          </div>

          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void markAllRead()}
              className="h-7 text-xs text-muted-foreground"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              {t.notifications.markAllRead}
            </Button>
          ) : null}
        </header>

        <div className="max-h-[24rem] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
              <Bell className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">{t.notifications.emptyTitle}</p>
              <p className="text-xs text-muted-foreground text-pretty">
                {t.notifications.emptyBody}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const Icon = ICONS[item.type] ?? Bell;

                const content = (
                  <>
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                        item.isRead
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm leading-snug",
                          item.isRead ? "text-muted-foreground" : "font-medium",
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="block truncate pt-0.5 text-xs text-muted-foreground">
                        {item.body}
                      </span>
                      <span className="block pt-1 text-[0.6875rem] text-muted-foreground tabular">
                        {formatRelative(item.createdAt, locale)}
                      </span>
                    </span>

                    {!item.isRead ? (
                      <span
                        aria-hidden
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                      />
                    ) : null}
                  </>
                );

                const className = cn(
                  "flex w-full items-start gap-2.5 px-3 py-2.5 text-start transition-colors",
                  "hover:bg-accent/60 focus-visible:outline-none focus-visible:bg-accent/60",
                );

                return (
                  <li key={item.id}>
                    {item.linkUrl ? (
                      <Link
                        href={item.linkUrl}
                        className={className}
                        onClick={() => {
                          if (!item.isRead) void markRead(item.id);
                          setOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={className}
                        onClick={() => {
                          if (!item.isRead) void markRead(item.id);
                        }}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
