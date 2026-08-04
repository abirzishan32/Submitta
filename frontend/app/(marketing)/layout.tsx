import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Public marketing shell.
 *
 * The session is read here purely so the navigation can offer "Go to dashboard"
 * to someone already signed in, rather than asking them to sign in again. It
 * grants nothing: every page under this layout is public.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav user={user} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
