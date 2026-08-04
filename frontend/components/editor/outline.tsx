"use client";

import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

/**
 * Document outline.
 *
 * Built from the document's headings rather than a maintained table of
 * contents, so it can never disagree with the document. Clicking scrolls and
 * places the caret, which is what makes it navigation rather than a summary.
 */
export function DocumentOutline({
  editor,
  headings,
}: {
  editor: Editor;
  headings: Array<{ level: number; text: string; pos: number }>;
}) {
  return (
    <aside className="hidden w-56 shrink-0 overflow-y-auto border-e border-border bg-muted/20 p-3 lg:block">
      <p className="px-2 pb-2 text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground/70">
        Outline
      </p>

      {headings.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">
          Headings you add will appear here.
        </p>
      ) : (
        <nav aria-label="Document outline">
          <ul className="space-y-0.5">
            {headings.map((heading, index) => (
              <li key={`${heading.pos}-${index}`}>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().setTextSelection(heading.pos + 1).run();
                    editor.view.dom
                      .querySelector(`[data-block-id]:nth-of-type(${index + 1})`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className={cn(
                    "block w-full truncate rounded px-2 py-1 text-start text-xs transition-colors",
                    "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    heading.level === 1
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                  // Indent by level, capped so a deep heading never disappears
                  // off the edge of a narrow rail.
                  style={{ paddingInlineStart: `${Math.min(heading.level - 1, 3) * 10 + 8}px` }}
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </aside>
  );
}
