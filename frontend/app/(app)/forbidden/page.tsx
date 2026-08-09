import Link from "next/link";
import { ShieldX } from "lucide-react";

import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Access denied" };

/** Where each role belongs, so the way out leads somewhere useful. */
const ROLE_HOME: Record<string, string> = {
  Admin: "/admin",
  Teacher: "/teacher",
  Student: "/student",
};

/**
 * Shown when a signed-in user asks for a section their role does not cover —
 * a student opening an admin URL, a teacher opening an admin-only one.
 *
 * `proxy.ts` redirects here before the requested page renders, so no protected
 * data is ever fetched: the API call that would have returned 403 is never made.
 * That redirect is a courtesy, not a control. The API remains the authority on
 * every request, and a tampered role cookie changes nothing but which of these
 * two pages a person sees.
 *
 * Rendered inside the signed-in layout on purpose — keeping the navigation
 * visible turns a dead end into somewhere you can leave from.
 */
export default async function ForbiddenPage() {
  const user = await getSessionUser();
  const home = ROLE_HOME[user?.role ?? ""] ?? "/";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
        <ShieldX className="size-5 text-muted-foreground" aria-hidden />
      </div>

      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Access denied</h1>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          {user
            ? `This section is not available to the ${user.role.toLowerCase()} role.`
            : "This section is not available to your role."}
        </p>
      </div>

      <Link
        href={home}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
