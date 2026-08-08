"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";

/**
 * Re-fetches a filtered list when its inputs change.
 *
 * Every list screen — student assignments, student submissions, the grading
 * queue, teacher assignments — needs the same behaviour: leave the
 * server-rendered first page alone, then reload whenever a filter, search term
 * or page changes, without blocking the interface while it happens. Each screen
 * had its own copy of that logic, which meant four places to change and, more
 * to the point, four copies of the same omission: the reload was fired with
 * `void load()` and nothing caught a rejection.
 *
 * The consequence was quiet rather than dramatic. A failed reload — an expired
 * session, a backend restart, a dropped connection — left the previous results
 * on screen with no indication anything had gone wrong. The user changes a
 * filter, the table does not change, and nothing explains why. This reports the
 * failure and keeps the last good data, which is more useful than an empty
 * table.
 *
 * @param load  Fetches and stores the next page. Stabilise it with
 *              `useCallback`; its dependencies are what trigger the reload.
 */
export function useListReload(load: () => Promise<void>) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Kept in a ref so `reload` stays referentially stable: it is handed to
  // dialogs and row actions as an "after you save, refresh" callback, and a new
  // identity on every render would re-run their effects.
  //
  // Updated in an effect rather than during render. Writing a ref while
  // rendering is not safe under concurrent rendering, where React may render a
  // component without committing it — the ref would then hold a value from work
  // that was thrown away.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  // The first render is skipped: the page was server-rendered with its first
  // page of results already in place, and re-fetching it immediately would be
  // a wasted round trip that also makes the list flicker on arrival.
  const settled = useRef(false);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }

    // Guards against a slow first request resolving after a faster second one
    // and overwriting newer results with older ones.
    let current = true;

    startTransition(() => {
      void load()
        .then(() => {
          if (current) setError(null);
        })
        .catch((cause: unknown) => {
          if (!current) return;

          // A ClientApiError carries the API's own message, which is more
          // specific than anything that could be written here.
          const message =
            cause instanceof ClientApiError ? cause.message : t.errors.generic;

          setError(message);
          toast.error(message);
        });
    });

    return () => {
      current = false;
    };
    // `t` is intentionally omitted: changing language should not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  /**
   * Reloads on demand — after a create, edit or delete elsewhere on the page.
   * Errors are reported the same way as an automatic reload, so a refresh that
   * fails after a successful save cannot leave the table silently stale.
   */
  const reload = useCallback(() => {
    startTransition(() => {
      void loadRef
        .current()
        .then(() => setError(null))
        .catch((cause: unknown) => {
          const message =
            cause instanceof ClientApiError ? cause.message : t.errors.generic;

          setError(message);
          toast.error(message);
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isPending, error, reload };
}
