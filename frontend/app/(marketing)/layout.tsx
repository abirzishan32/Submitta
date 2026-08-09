import { Instrument_Serif, Caveat } from "next/font/google";

import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Two faces the rest of the application has no use for, so they are loaded here
 * rather than in the root layout — a signed-in teacher marking work should not
 * pay for the landing page's display type.
 */

/** Display face. High contrast and a true italic-era feel: editorial, not techy. */
const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/**
 * The hand that writes the assignment.
 *
 * Drawn into a canvas texture rather than laid out as DOM, so the family name is
 * read off `.style.fontFamily` and handed to the painter.
 */
const hand = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const handwritingFontFamily = hand.style.fontFamily;

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
    <SmoothScroll>
      <div
        className={`${display.variable} ${hand.variable} flex min-h-screen flex-col`}
      >
        <SiteNav user={user} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </SmoothScroll>
  );
}
