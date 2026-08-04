import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  UserPlus,
  ClipboardList,
  CheckSquare,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

import type { Dictionary } from "@/lib/i18n";
import type { UserRole } from "@/lib/api/types";

export interface NavItem {
  href: string;
  label: (t: Dictionary) => string;
  icon: LucideIcon;
  /** Matches nested routes too, so a detail page keeps its parent highlighted. */
  matchPrefix?: boolean;
}

export interface NavSection {
  label: (t: Dictionary) => string;
  items: NavItem[];
}

/**
 * Navigation per role.
 *
 * Defined as data rather than as JSX so the sidebar, the mobile sheet and the
 * breadcrumb trail all read from one source — three hand-maintained copies is
 * how navigation drifts out of sync.
 *
 * Hiding a section is presentation only. Every route behind it is enforced by
 * the API, which never takes the client's word for a role.
 */
export const NAVIGATION: Record<UserRole, NavSection[]> = {
  Admin: [
    {
      label: (t) => t.nav.dashboard,
      items: [
        { href: "/admin", label: (t) => t.nav.dashboard, icon: LayoutDashboard },
      ],
    },
    {
      label: (t) => t.nav.administration,
      items: [
        { href: "/admin/users", label: (t) => t.nav.users, icon: Users, matchPrefix: true },
        { href: "/admin/classes", label: (t) => t.nav.classes, icon: GraduationCap, matchPrefix: true },
        { href: "/admin/subjects", label: (t) => t.nav.subjects, icon: BookOpen, matchPrefix: true },
        { href: "/admin/offerings", label: (t) => t.nav.offerings, icon: Layers, matchPrefix: true },
        { href: "/admin/enrollments", label: (t) => t.nav.enrollments, icon: UserPlus, matchPrefix: true },
      ],
    },
    {
      label: (t) => t.nav.teaching,
      items: [
        { href: "/admin/assignments", label: (t) => t.nav.assignments, icon: ClipboardList, matchPrefix: true },
        { href: "/admin/submissions", label: (t) => t.nav.submissions, icon: CheckSquare, matchPrefix: true },
        { href: "/admin/settings", label: (t) => t.nav.settings, icon: Settings, matchPrefix: true },
      ],
    },
  ],

  Teacher: [
    {
      label: (t) => t.nav.dashboard,
      items: [
        { href: "/teacher", label: (t) => t.nav.dashboard, icon: LayoutDashboard },
      ],
    },
    {
      label: (t) => t.nav.teaching,
      items: [
        { href: "/teacher/assignments", label: (t) => t.nav.assignments, icon: ClipboardList, matchPrefix: true },
        { href: "/teacher/grading", label: (t) => t.nav.grading, icon: CheckSquare, matchPrefix: true },
      ],
    },
  ],

  Student: [
    {
      label: (t) => t.nav.dashboard,
      items: [
        { href: "/student", label: (t) => t.nav.dashboard, icon: LayoutDashboard },
      ],
    },
    {
      label: (t) => t.nav.myWork,
      items: [
        { href: "/student/assignments", label: (t) => t.nav.assignments, icon: FileText, matchPrefix: true },
        { href: "/student/submissions", label: (t) => t.nav.submissions, icon: CheckSquare, matchPrefix: true },
      ],
    },
  ],
};

export function isActiveRoute(pathname: string, item: NavItem): boolean {
  if (item.matchPrefix) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return pathname === item.href;
}

/** The role's landing page. */
export function homeFor(role: UserRole): string {
  return { Admin: "/admin", Teacher: "/teacher", Student: "/student" }[role];
}
