"use client";

import { useEffect, useMemo } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";

import { cn } from "@/lib/utils";
import { buildExtensions } from "@/lib/editor/extensions";
import { SlashMenu } from "./slash-menu";
import { EditorToolbar } from "./toolbar";
import "./editor.css";

/**
 * A document editor without the replay machinery.
 *
 * The student's editor records every keystroke, because how their answer came
 * to exist is the point. A teacher writing a brief needs none of that — so this
 * shares the extensions, the toolbar and the slash palette, and nothing else.
 *
 * The same component renders read-only, which is how the brief is displayed to
 * students. One code path means the writing and the reading cannot drift.
 */
export function RichText({
  value,
  fallback,
  editable = false,
  placeholder,
  onChange,
  className,
  minHeight = "10rem",
}: {
  /** The document as Tiptap JSON. Null for an assignment written as plain text. */
  value: string | null;
  /** Plain text to show when there is no rich document. */
  fallback?: string;
  editable?: boolean;
  placeholder?: string;
  /** Called with both forms, because the API stores both. */
  onChange?: (json: string, text: string) => void;
  className?: string;
  minHeight?: string;
}) {
  const content = useMemo(() => parse(value, fallback), [value, fallback]);

  const editor = useEditor({
    extensions: buildExtensions({ placeholder }),
    content,
    editable,
    // Next renders this on the server; ProseMirror needs the DOM.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "editor-prose focus:outline-none",
        spellcheck: String(editable),
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(JSON.stringify(editor.getJSON()), editor.getText());
    },
  });

  // Keeps a read-only view in step when the document it is showing changes —
  // switching between submissions, for instance.
  useEffect(() => {
    if (editor && !editable) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, editable, content]);

  if (!editor) {
    return (
      <div
        className={cn("rounded-lg border border-border bg-card", className)}
        style={{ minHeight }}
      />
    );
  }

  if (!editable) {
    return (
      <div className={cn("editor-readonly", className)}>
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <EditorToolbar editor={editor} onAction={() => {}} />

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ minHeight }}>
        <EditorContent editor={editor} className="px-4 py-3" />
      </div>

      <SlashMenu editor={editor} onCommand={() => {}} />

      <div className="flex items-center justify-end border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span className="tabular">
          {editor.storage.characterCount.words()} words
        </span>
      </div>
    </div>
  );
}

/**
 * Chooses what to show.
 *
 * Prefers the rich document, falling back to plain text — an assignment written
 * before the editor existed, or one whose question is an attached PDF, has only
 * the latter and must still render.
 */
function parse(json: string | null, fallback?: string) {
  if (json) {
    try {
      return JSON.parse(json);
    } catch {
      // Corrupt JSON should not cost the reader the text.
    }
  }

  if (!fallback?.trim()) return "";

  return {
    type: "doc",
    content: fallback.split(/\n{2,}/).map((paragraph) => ({
      type: "paragraph",
      content: paragraph ? [{ type: "text", text: paragraph }] : [],
    })),
  };
}

export type { Editor };
