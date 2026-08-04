"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Route-level error boundary.
 *
 * Shows the digest rather than the message: in production Next.js replaces
 * server error messages with an opaque digest, and printing that gives the user
 * something to quote when reporting the problem. The raw error goes to the
 * console for whoever is debugging.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" aria-hidden />
      </div>

      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          The page could not be loaded. Try again in a moment.
        </p>
        {error.digest ? (
          <p className="pt-1 font-[family-name:var(--font-mono-code)] text-xs text-muted-foreground/70">
            {error.digest}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Try again
      </button>
    </div>
  );
}
