import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading state.
 *
 * Shaped like the pages it stands in for — a heading, a row of tiles, a table —
 * so navigation reads as content arriving rather than as a blank screen with a
 * spinner. Next renders this while a Server Component awaits its data.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-12" />
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 py-1.5">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              {/* Varying widths, so the placeholder reads as text rather than bars. */}
              <Skeleton className="h-3.5" style={{ width: `${45 + ((index * 17) % 30)}%` }} />
              <Skeleton className="h-3" style={{ width: `${25 + ((index * 11) % 20)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
