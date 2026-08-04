"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardPaste, FileClock, Loader2, PlayCircle, Timer } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/common/status-badge";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { formatDuration } from "@/lib/editor/replay-analysis";
import type { ReplayDto, WritingAnalytics } from "@/lib/api/editor-types";
import type { SubmissionDetail } from "@/lib/api/types";
import { AnalysisWorkspace } from "./analysis-workspace";

/**
 * The way into the replay from the grading page.
 *
 * Loads the summary with the page but the event log only on demand: the log is
 * by far the largest thing attached to a submission, and most marking never
 * opens it. The summary is enough to decide whether it is worth opening.
 */
export function ReplayLauncher({ submission }: { submission: SubmissionDetail }) {
  const [analytics, setAnalytics] = useState<WritingAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [replay, setReplay] = useState<ReplayDto | null>(null);
  const [opening, setOpening] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<WritingAnalytics>(`/api/v1/submissions/${submission.id}/analytics`)
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ClientApiError ? err.message : "Writing history unavailable.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [submission.id]);

  const openWorkspace = useCallback(async () => {
    if (replay) {
      setOpen(true);
      return;
    }

    setOpening(true);

    try {
      const data = await apiClient.get<ReplayDto>(
        `/api/v1/submissions/${submission.id}/replay`,
      );
      setReplay(data);
      setOpen(true);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "The replay could not be loaded.");
    } finally {
      setOpening(false);
    }
  }, [replay, submission.id]);

  // The workspace takes over the viewport, so the page behind it must not also
  // scroll.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3.5">
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
        <span className="text-xs text-muted-foreground">Loading writing history…</span>
      </div>
    );
  }

  // Work submitted before the editor existed has nothing to replay. Saying so
  // beats offering a button that opens an empty player.
  if (analytics.totalDurationMs === 0 && analytics.wordsTyped === 0) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-border px-4 py-3.5">
        <FileClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-sm font-medium">No writing history</p>
          <p className="text-xs text-muted-foreground text-pretty">
            This was submitted without the editor, so there are no recorded edits
            to play back.
          </p>
        </div>
      </div>
    );
  }

  const pasteHeavy = analytics.pastePercentage >= 40;

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border bg-card p-4",
          pasteHeavy ? "border-warning/40" : "border-border",
        )}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight">How this was written</h2>
          <p className="pt-0.5 text-xs text-muted-foreground text-pretty">
            Every edit was recorded. Watch it unfold, or read the charts.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Timer className="size-3.5" aria-hidden />
              <span className="font-medium tabular text-foreground">
                {formatDuration(analytics.activeWritingMs)}
              </span>
              writing
            </span>

            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="font-medium tabular text-foreground">
                {analytics.wordsTyped.toLocaleString()}
              </span>
              words typed
            </span>

            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-muted-foreground",
                pasteHeavy && "text-warning",
              )}
            >
              <ClipboardPaste className="size-3.5" aria-hidden />
              <span
                className={cn(
                  "font-medium tabular",
                  pasteHeavy ? "text-warning" : "text-foreground",
                )}
              >
                {analytics.wordsPasted.toLocaleString()}
              </span>
              pasted
            </span>

            {pasteHeavy ? (
              <StatusPill tone="warning">{analytics.pastePercentage}% of the total</StatusPill>
            ) : null}
          </div>
        </div>

        <Button onClick={openWorkspace} disabled={opening} className="shrink-0">
          {opening ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <PlayCircle className="size-4" aria-hidden />
          )}
          Replay &amp; analytics
        </Button>
      </div>

      {open && replay ? (
        <AnalysisWorkspace
          replay={replay}
          submission={submission}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
