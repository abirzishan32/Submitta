"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, LogOut, Menu, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";
import { NotificationProvider } from "@/components/providers/notification-provider";
import { useTranslation } from "@/components/providers/i18n-provider";
import { initialsOf } from "@/lib/format";
import type { UserProfile } from "@/lib/api/types";

/**
 * The application frame: a fixed sidebar on desktop, a slide-over sheet on
 * mobile, and a sticky header carrying identity and preferences.
 *
 * Layout, not data. Each page renders its own content inside `children`, so the
 * shell never re-renders when a page's data changes.
 */
export function AppShell({
  user,
  children,
}: {
  user: UserProfile;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();

  return (
    // One provider around the whole shell, so there is a single stream
    // connection per tab rather than one per component that wants the count.
    <NotificationProvider enabled>
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Brand href="/" />
        <SidebarNav role={user.role} />
        <SidebarFooter user={user} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">{t.nav.toggleSidebar}</SheetTitle>
          <Brand href="/" />
          <SidebarNav role={user.role} onNavigate={() => setMobileOpen(false)} />
          <SidebarFooter user={user} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border px-4",
            // Slight translucency so content scrolling underneath is felt
            // rather than seen — no heavy glass panel.
            "bg-background/85 backdrop-blur-sm supports-[backdrop-filter]:bg-background/70",
          )}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label={t.nav.toggleSidebar}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" aria-hidden />
          </Button>

          <div className="flex-1" />

          <NotificationBell />
          <LanguageSwitcher />
          <ThemeToggle />
          <UserMenu user={user} />
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
    </NotificationProvider>
  );
}

function Brand({ href }: { href: string }) {
  const { t } = useTranslation();

  return (
    <Link
      href={href}
      className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4 transition-opacity hover:opacity-80"
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <GraduationCap className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">
          {t.common.appName}
        </span>
      </span>
    </Link>
  );
}

function SidebarFooter({ user }: { user: UserProfile }) {
  const { t } = useTranslation();

  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
        <Avatar className="size-7">
          <AvatarFallback className="bg-sidebar-accent text-[0.6875rem] font-medium text-sidebar-accent-foreground">
            {initialsOf(user.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium leading-tight">{user.fullName}</p>
          <p className="truncate text-[0.6875rem] text-muted-foreground">
            {t.roles[user.role]}
          </p>
        </div>
      </div>
    </div>
  );
}

function UserMenu({ user }: { user: UserProfile }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success(t.auth.signedOut);
      // replace(), so the back button cannot return to a signed-in page.
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error(t.errors.generic);
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={t.nav.account} className="rounded-full">
            <Avatar className="size-7">
              <AvatarFallback className="bg-accent text-[0.6875rem] font-medium text-accent-foreground">
                {initialsOf(user.fullName)}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link href="/profile" />}>
          <UserIcon className="size-4" aria-hidden />
          {t.nav.profile}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={signOut}
          disabled={signingOut}
          className="text-destructive data-highlighted:text-destructive"
        >
          <LogOut className="size-4" aria-hidden />
          {t.nav.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
