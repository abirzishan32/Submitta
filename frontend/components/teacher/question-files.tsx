"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";

export interface AssignmentFile {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

/**
 * The question paper, when the teacher would rather attach one than type it.
 *
 * Uploads immediately rather than on form submit, because the assignment has to
 * exist before a file can belong to it. That is why this only appears once the
 * assignment has been saved — offering it on a blank form would promise
 * something that cannot work.
 */
export function QuestionFiles({
  assignmentId,
  files,
  onChange,
  readOnly = false,
}: {
  assignmentId: string;
  files: AssignmentFile[];
  onChange: (files: AssignmentFile[]) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    // Checked here as well as server-side, so an obvious mistake costs nothing
    // and does not push ten megabytes up the wire to be refused.
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files can be attached.");
      return;
    }

    if (file.size > MAX_BYTES) {
      toast.error(`That file is larger than the ${MAX_BYTES / 1024 / 1024} MB limit.`);
      return;
    }

    if (files.length >= MAX_FILES) {
      toast.error(`An assignment can have at most ${MAX_FILES} files.`);
      return;
    }

    setBusy(true);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch(
        `/api/proxy-upload/api/v1/assignments/${assignmentId}/attachments`,
        { method: "POST", body },
      );

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        toast.error(payload?.message ?? t.errors.generic);
        return;
      }

      onChange([...files, payload.data as AssignmentFile]);
      toast.success("File attached.");
    } catch {
      toast.error(t.errors.network);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(file: AssignmentFile) {
    try {
      await apiClient.delete(
        `/api/v1/assignments/${assignmentId}/attachments/${file.id}`,
      );
      onChange(files.filter((f) => f.id !== file.id));
      toast.success("File removed.");
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : t.errors.generic);
    }
  }

  return (
    <div className="space-y-2.5">
      {!readOnly ? (
        <div>
          <Label>Question paper</Label>
          <p className="pt-0.5 text-xs text-muted-foreground text-pretty">
            Attach a PDF instead of — or as well as — writing the brief above.
            Up to {MAX_FILES} files, {MAX_BYTES / 1024 / 1024} MB each.
          </p>
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />

              <a
                href={`/api/proxy/api/v1/assignments/${assignmentId}/attachments/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-medium text-primary transition-opacity hover:opacity-70"
              >
                {file.fileName}
              </a>

              <span className="shrink-0 text-xs text-muted-foreground tabular">
                {formatSize(file.sizeBytes)}
              </span>

              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${file.fileName}`}
                  onClick={() => void remove(file)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!readOnly && files.length < MAX_FILES ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) void upload(dropped);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Upload className="size-4 text-muted-foreground" aria-hidden />
          )}

          <p className="text-sm text-muted-foreground">
            Drop a PDF here, or{" "}
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="font-medium text-primary transition-opacity hover:opacity-70"
            >
              choose a file
            </button>
          </p>

          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              if (chosen) void upload(chosen);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
