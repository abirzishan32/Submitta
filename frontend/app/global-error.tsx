"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary.
 *
 * `app/error.tsx` wraps the pages *below* the root layout, but not the root
 * layout itself — so anything that fails there (reading the locale cookie,
 * mounting a provider) escapes it entirely and the visitor gets the browser's
 * unstyled crash screen. This file is the only thing that catches that, and it
 * replaces the root layout when it renders, which is why it declares its own
 * `<html>` and `<body>`.
 *
 * Styles are inline on purpose. Global CSS is not loaded for this document, so
 * a class name here would resolve to nothing and the page would render as
 * unstyled black-on-white text. The colours are duplicated from the theme
 * rather than referenced, and follow the OS colour scheme because the app's own
 * theme toggle — a class on `<html>` — is not applied to this document either.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nothing upstream will report this one, so the console is the only record.
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          backgroundColor: "#fdfdfe",
          color: "#16181f",
          colorScheme: "light dark",
        }}
      >
        {/* metadata exports are unavailable in a client error boundary. */}
        <title>Something went wrong · Submitta</title>

        <main style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.125rem",
              fontWeight: 600,
              letterSpacing: "-0.011em",
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              opacity: 0.7,
            }}
          >
            The application could not start. Reloading usually resolves it.
          </p>

          {/* In production Next.js replaces the message with an opaque digest;
              showing it gives the user something precise to quote. */}
          {error.digest ? (
            <p
              style={{
                margin: "0.75rem 0 0",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.75rem",
                opacity: 0.55,
              }}
            >
              {error.digest}
            </p>
          ) : null}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 0.875rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#fdfdfe",
              backgroundColor: "#16181f",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
