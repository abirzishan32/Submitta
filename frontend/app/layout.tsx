import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Bengali } from "next/font/google";
import { cookies } from "next/headers";

import { ThemeProvider, ThemeScript } from "@/components/providers/theme-provider";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { Toaster } from "@/components/ui/toaster";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Latin faces have no Bengali coverage, so Bangla would otherwise fall back to
 * whatever the OS provides — a different weight and rhythm on every machine.
 */
const notoBengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Submitta · Assignment & Submission Management",
    template: "%s · Submitta",
  },
  description:
    "Role-based assignment and submission management for schools and colleges.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfdfe" },
    { media: "(prefers-color-scheme: dark)", color: "#16181f" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Next 16: cookies() is async.
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      // The server already knows the locale, so `lang` is correct on the first
      // paint — which is what the :lang(bn) line-height rules key off.
      suppressHydrationWarning
      className={`${inter.variable} ${notoBengali.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        {/* Sets the theme class before first paint, so a dark-mode user never
            sees a white flash. Server-rendered only. */}
        <ThemeScript />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <ThemeProvider>
          <I18nProvider locale={locale}>
            {children}
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
