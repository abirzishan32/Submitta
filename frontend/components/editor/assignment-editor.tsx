"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  Check,
  CloudOff,
  HardDrive,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { buildExtensions } from "@/lib/editor/extensions";
import { EditingRecorder, EventType, type RecordedEvent } from "@/lib/editor/recorder";
import { apiClient } from "@/lib/api/client";
import { SlashMenu } from "./slash-menu";
import { EditorToolbar } from "./toolbar";
import { DocumentOutline } from "./outline";
import "./editor.css";

export type SaveState = "idle" | "saving" | "saved" | "local" | "error";

/**
 * The writing surface.
 *
 * Owns three things that have to stay in step: the document, the operation log,
 * and what has reached the server. They are flushed together — a batch carries
 * both its events and the document they produced, so a save can never describe
 * a state the log does not explain.
 */
export function AssignmentEditor({
  submissionId,
  draftKey,
  initialContentJson,
  initialText,
  startSequence,
  baseOffsetMs,
  readOnly,
  onStateChange,
  onEditorReady,
}: {
  /**
   * The submission this document belongs to, or null before one exists.
   *
   * When null the editor keeps its work locally — the log stays buffered and
   * the document is mirrored to this browser — and hands both over when the
   * student submits. That way the replay is complete from the first keystroke
   * rather than starting at whatever was already typed.
   */
  submissionId: string | null;
  /** Where a not-yet-submitted document is mirrored locally. */
  draftKey?: string;
  initialContentJson: string | null;
  initialText: string;
  /** Resumes the log after a reload so sequence numbers stay unique. */
  startSequence: number;
  /** Time already spent in earlier sittings, keeping the replay continuous. */
  baseOffsetMs: number;
  readOnly?: boolean;
  onStateChange?: (state: {
    words: number;
    characters: number;
    readingMinutes: number;
    saveState: SaveState;
    lastSavedAt: Date | null;
  }) => void;
  onEditorReady?: (editor: Editor, recorder: EditingRecorder | null) => void;
}) {
  const recorder = useRef<EditingRecorder | null>(null);
  if (recorder.current === null && !readOnly) {
    recorder.current = new EditingRecorder(startSequence, baseOffsetMs);
  }

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showOutline, setShowOutline] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Guards against two flushes overlapping and reordering the log. */
  const flushing = useRef(false);

  const editor = useEditor({
    extensions: buildExtensions(),
    content: parseContent(initialContentJson ?? readLocalDraft(draftKey), initialText),
    editable: !readOnly,
    // Next renders this on the server; ProseMirror needs the DOM.
    immediatelyRender: false,

    editorProps: {
      attributes: {
        class: "editor-prose focus:outline-none",
        spellcheck: "true",
      },

      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const html = event.clipboardData?.getData("text/html") ?? "";

        // Flagged before the transaction lands, because the clipboard is only
        // readable from the DOM event. Distinguishing paste from typing is the
        // entire point of the log, so this must not be missed.
        if (text) recorder.current?.notePaste(text, Boolean(html));

        return false;
      },

      handleKeyDown: (_view, event) => {
        if (!(event.metaKey || event.ctrlKey)) return false;

        const key = event.key.toLowerCase();

        if (key === "s") {
          event.preventDefault();
          void flush({ manual: true, version: true });
          return true;
        }

        if (key === "z") {
          recorder.current?.historyStep(editorRef.current!, event.shiftKey);
          return false;
        }

        return false;
      },
    },

    onUpdate: ({ editor, transaction }) => {
      recorder.current?.handleTransaction(editor, transaction);
      scheduleFlush();
      report(editor);
    },

    onSelectionUpdate: ({ editor, transaction }) => {
      recorder.current?.handleTransaction(editor, transaction);
    },
  });

  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // --- Reporting ---------------------------------------------------------

  const report = useCallback(
    (instance: Editor) => {
      const characters = instance.storage.characterCount.characters();
      const words = instance.storage.characterCount.words();

      onStateChange?.({
        words,
        characters,
        // 220 words per minute is the usual figure for silent reading of prose.
        readingMinutes: Math.max(1, Math.round(words / 220)),
        saveState,
        lastSavedAt,
      });
    },
    [onStateChange, saveState, lastSavedAt],
  );

  useEffect(() => {
    if (editor) report(editor);
  }, [editor, report]);

  // --- Flushing ----------------------------------------------------------

  const flush = useCallback(
    async (options: { manual?: boolean; version?: boolean; keepalive?: boolean } = {}) => {
      const instance = editorRef.current;
      const rec = recorder.current;
      if (!instance || !rec || readOnly) return;

      if (flushing.current) return;

      // Before a submission exists there is nowhere on the server to record
      // against, so the document is mirrored locally and the log stays in the
      // recorder. Both are handed over on submit.
      if (!submissionId) {
        if (draftKey) {
          try {
            localStorage.setItem(
              draftKey,
              JSON.stringify({ contentJson: instance.getJSON(), savedAt: Date.now() }),
            );
            setSaveState("local");
            setLastSavedAt(new Date());
          } catch {
            // A full or disabled store is not worth interrupting writing for.
            setSaveState("error");
          }
        }
        return;
      }

      rec.saved(options.manual ?? false);
      const events = rec.drain();

      if (events.length === 0 && !options.manual) return;

      flushing.current = true;
      setSaveState("saving");

      try {
        await apiClient.post(`/api/v1/submissions/${submissionId}/events`, {
          events,
          contentJson: JSON.stringify(instance.getJSON()),
          plainText: instance.getText(),
          createVersion: options.version ?? false,
          versionReason: options.manual ? "manual" : "autosave",
        });

        setSaveState("saved");
        setLastSavedAt(new Date());
      } catch {
        // Hand the events back rather than dropping them — a dropped batch
        // leaves a hole in the replay that cannot be recovered.
        rec.restore(events);
        setSaveState("error");
      } finally {
        flushing.current = false;
      }
    },
    [submissionId, draftKey, readOnly],
  );

  /**
   * Debounced autosave.
   *
   * Two seconds after typing stops: long enough that a sentence is one save,
   * short enough that a closed laptop loses almost nothing.
   */
  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => void flush(), 2_000);
  }, [flush]);

  // --- Lifecycle ---------------------------------------------------------

  useEffect(() => {
    if (!editor || readOnly) return;

    recorder.current?.open(editor.storage.characterCount.words());
    onEditorReady?.(editor, recorder.current);

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        recorder.current?.focusLost();
        // Tab-close and navigation both land here; keepalive lets the request
        // outlive the page.
        void flush({ keepalive: true });
      } else {
        recorder.current?.focusRegained();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      recorder.current?.close();
      void flush();
      recorder.current?.dispose();
    };
    // Intentionally once: this is session setup, not a reactive effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, readOnly]);

  // Fullscreen is a layout mode rather than the Fullscreen API, so the toolbar
  // and status bar stay reachable.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && fullscreen) setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const outlineHeadings = useOutline(editor);

  if (!editor) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border border-border">
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card",
        fullscreen && "fixed inset-0 z-50 rounded-none border-0",
      )}
    >
      {!readOnly ? (
        <div className="flex items-center gap-1 border-b border-border">
          <EditorToolbar
            editor={editor}
            onAction={(mark, active) => recorder.current?.formatted(editor, mark, active)}
            className="flex-1 border-b-0"
          />

          <div className="flex shrink-0 items-center gap-0.5 px-2">
            <IconToggle
              label="Outline"
              active={showOutline}
              onClick={() => setShowOutline((v) => !v)}
            >
              <PanelLeft className="size-3.5" aria-hidden />
            </IconToggle>

            <IconToggle
              label="Focus mode"
              active={focusMode}
              onClick={() => setFocusMode((v) => !v)}
            >
              <span className="text-[0.625rem] font-medium">Focus</span>
            </IconToggle>

            <IconToggle
              label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setFullscreen((v) => !v)}
            >
              {fullscreen ? (
                <Minimize2 className="size-3.5" aria-hidden />
              ) : (
                <Maximize2 className="size-3.5" aria-hidden />
              )}
            </IconToggle>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {showOutline ? (
          <DocumentOutline editor={editor} headings={outlineHeadings} />
        ) : null}

        <div
          className={cn(
            "min-w-0 flex-1 overflow-y-auto",
            focusMode && "editor-focus-mode",
          )}
        >
          {/* 720px keeps a line at roughly 75 characters, which is the range
              prose is most comfortably read at. */}
          <EditorContent
            editor={editor}
            className="mx-auto w-full max-w-[720px] px-6 py-10 sm:px-8"
          />
        </div>
      </div>

      {!readOnly ? (
        <>
          <SlashMenu
            editor={editor}
            onCommand={(command) => recorder.current?.blockChanged(editor, command.id)}
          />

          <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
            <SaveIndicator state={saveState} at={lastSavedAt} />

            <span className="tabular">
              {editor.storage.characterCount.words()} words ·{" "}
              {editor.storage.characterCount.characters()} characters
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SaveIndicator({ state, at }: { state: SaveState; at: Date | null }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-destructive">
        <CloudOff className="size-3" aria-hidden />
        Not saved — retrying
      </span>
    );
  }

  if (state === "local" && at) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <HardDrive className="size-3" aria-hidden />
        Kept on this device — submit to save it
      </span>
    );
  }

  if (state === "saved" && at) {
    return (
      <span className="inline-flex items-center gap-1.5 text-success">
        <Check className="size-3" aria-hidden />
        Saved {at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }

  return <span>Draft</span>;
}

function IconToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
      )}
    >
      {children}
    </button>
  );
}

/** Headings in document order, recomputed as the document changes. */
function useOutline(editor: Editor | null) {
  const [headings, setHeadings] = useState<
    Array<{ level: number; text: string; pos: number }>
  >([]);

  useEffect(() => {
    if (!editor) return;

    function rebuild() {
      const found: Array<{ level: number; text: string; pos: number }> = [];

      editor!.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          found.push({
            level: node.attrs.level as number,
            text: node.textContent || "Untitled",
            pos,
          });
        }
      });

      setHeadings(found);
    }

    rebuild();
    editor.on("update", rebuild);
    return () => {
      editor.off("update", rebuild);
    };
  }, [editor]);

  return headings;
}

/**
 * Recovers a document that was never submitted.
 *
 * Only consulted when the server has nothing, so a submitted document always
 * wins over a stale local copy — the alternative would let an old draft on one
 * machine overwrite work done on another.
 */
function readLocalDraft(key: string | undefined): string | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { contentJson?: unknown };
    return parsed.contentJson ? JSON.stringify(parsed.contentJson) : null;
  } catch {
    return null;
  }
}

/**
 * Chooses the starting document.
 *
 * Prefers the rich JSON, falling back to plain text — submissions made before
 * the editor existed have only the latter, and must still open.
 */
function parseContent(json: string | null, text: string) {
  if (json) {
    try {
      return JSON.parse(json);
    } catch {
      // Corrupt JSON should not cost the student their text.
    }
  }

  if (!text.trim()) return "";

  return {
    type: "doc",
    content: text.split(/\n{2,}/).map((paragraph) => ({
      type: "paragraph",
      content: paragraph ? [{ type: "text", text: paragraph }] : [],
    })),
  };
}

export { EventType };
