import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/auth/session";
import { SessionExpiredBoundary } from "@/components/layout/session-expired-boundary";

/**
 * Layout for every signed-in page.
 *
 * `proxy.ts` already turns anonymous visitors away, so this is a second gate
 * rather than the first — it exists because a layout that assumes a user must
 * not render at all when there isn't one.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell user={user}>
      <SessionExpiredBoundary>{children}</SessionExpiredBoundary>
    </AppShell>
  );
}
