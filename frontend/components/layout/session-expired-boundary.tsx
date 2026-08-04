"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle, LogIn, RotateCcw } from "lucide-react";

/**
 * Catches errors thrown while rendering a page's server data.
 *
 * `proxy.ts` refreshes an expired access token before the request reaches a
 * page, so a 401 here means the session is genuinely finished — usually because
 * the refresh token was revoked elsewhere. Without this the whole route crashes
 * to Next's generic "server error" screen, which tells the user nothing and
 * offers them no way out.
 */
export class SessionExpiredBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // The API's message survives into production; anything else is generic.
    const isAuth = /session|expired|unauthor/i.test(error.message);

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <AlertCircle className="size-5 text-muted-foreground" aria-hidden />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">
            {isAuth ? "Your session has ended" : "Something went wrong"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            {isAuth
              ? "Please sign in again to continue."
              : "The page could not be loaded. Try again in a moment."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isAuth) {
              window.location.href = "/login";
            } else {
              window.location.reload();
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {isAuth ? (
            <>
              <LogIn className="size-3.5" aria-hidden />
              Sign in
            </>
          ) : (
            <>
              <RotateCcw className="size-3.5" aria-hidden />
              Try again
            </>
          )}
        </button>
      </div>
    );
  }
}
