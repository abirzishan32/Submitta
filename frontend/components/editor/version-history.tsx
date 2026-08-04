"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StatusPill } from "@/components/common/status-badge";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatRelative } from "@/lib/format";
import type { SubmissionVersion } from "@/lib/api/editor-types";

/**
 * Version history for a submission.
 *
 * Versions are snapshots taken at meaningful moments — a manual save, a
 * submit — rather than on every autosave, which would bury the useful ones in
 * hundreds of near-identical rows.
 */
export function VersionHistory({
  submissionId,
  onRestored,
}: {
  submissionId: string;
  onRestored?: () => void;
}) {
  const { locale, t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<SubmissionVersion[] | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setVersions(
        await apiClient.get<SubmissionVersion[]>(
          `/api/v1/submissions/${submissionId}/versions`,
        ),
      );
    } catch {
      setVersions([]);
    }
  }, [submissionId]);

  // Fetched when opened rather than on mount: most writing sessions never look
  // at history, and the list is stale the moment the student saves again.
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function restore(versionNumber: number) {
    setRestoring(versionNumber);

    try {
      await apiClient.post(
        `/api/v1/submissions/${submissionId}/versions/${versionNumber}/restore`,
        {},
      );
      toast.success(`Restored version ${versionNumber}.`);
      setOpen(false);
      onRestored?.();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : t.errors.generic);
    } finally {
      setRestoring(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm">
            <History className="size-3.5" aria-hidden />
            History
          </Button>
        }
      />

      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Snapshots taken when you saved or submitted. Restoring adds a new
            version rather than erasing the ones after it.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {versions === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : versions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground text-pretty">
              No versions yet. Press ⌘S while writing to save one.
            </p>
          ) : (
            <ol className="space-y-2">
              {versions.map((version, index) => (
                <li
                  key={version.id}
                  className={cn(
                    "rounded-lg border border-border p-3",
                    index === 0 && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium tabular">
                      Version {version.versionNumber}
                    </span>
                    {index === 0 ? (
                      <StatusPill tone="info">Current</StatusPill>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={restoring !== null}
                        onClick={() => restore(version.versionNumber)}
                      >
                        {restoring === version.versionNumber ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <RotateCcw className="size-3.5" aria-hidden />
                        )}
                        Restore
                      </Button>
                    )}
                  </div>

                  <p className="pt-1 text-xs text-muted-foreground tabular">
                    {version.wordCount.toLocaleString()} words ·{" "}
                    {describeReason(version.reason)} ·{" "}
                    {formatRelative(version.createdAt, locale)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Turns the stored reason code into something a student would recognise. */
function describeReason(reason: string): string {
  if (reason.startsWith("restore:")) {
    return `restored from version ${reason.slice("restore:".length)}`;
  }

  return (
    {
      manual: "saved manually",
      autosave: "auto-saved",
      submit: "submitted",
    }[reason] ?? reason
  );
}
