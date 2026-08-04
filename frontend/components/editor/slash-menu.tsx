"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

import { cn } from "@/lib/utils";
import { filterCommands, type SlashCommand } from "@/lib/editor/commands";

/**
 * The "/" command palette.
 *
 * Positioned from the caret's screen coordinates rather than rendered inline,
 * so it never disturbs the document — inserting a menu node into the document
 * would put it in the undo history and the replay log.
 *
 * Keyboard first: arrows move, Enter runs, Escape closes. The mouse works, but
 * a writer's hands are already on the keys.
 */
export function SlashMenu({
  editor,
  onCommand,
}: {
  editor: Editor;
  /** Runs after a command, so the shell can record it and handle uploads. */
  onCommand: (command: SlashCommand) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  /** Document position of the "/" that opened the menu. */
  const triggerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo(() => filterCommands(query), [query]);

  // Reset the highlight whenever the result set changes, so Enter never runs
  // whatever happened to be at a stale index.
  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    function close() {
      setOpen(false);
      setQuery("");
      triggerRef.current = null;
    }

    function onUpdate() {
      const { state } = editor;
      const { from } = state.selection;

      // Read back from the caret to the start of the block, looking for a "/"
      // that begins a word — mid-word slashes (a URL, a date) are not triggers.
      const before = state.doc.textBetween(
        Math.max(0, from - 60),
        from,
        "\n",
        "￼",
      );

      const match = /(?:^|\s)\/([\w-]*)$/.exec(before);

      if (!match) {
        if (open) close();
        return;
      }

      triggerRef.current = from - match[1].length - 1;
      setQuery(match[1]);

      const coords = editor.view.coordsAtPos(from);
      setPosition({ top: coords.bottom + 6, left: coords.left });
      setOpen(true);
    }

    editor.on("selectionUpdate", onUpdate);
    editor.on("update", onUpdate);

    return () => {
      editor.off("selectionUpdate", onUpdate);
      editor.off("update", onUpdate);
    };
  }, [editor, open]);

  useEffect(() => {
    if (!open) return;

    /**
     * Takes the key for the palette and keeps it from the editor.
     *
     * preventDefault alone would not be enough: ProseMirror binds its own
     * keydown handler and does not consult defaultPrevented, so Enter could
     * both run the command and split the block. Stopping propagation means the
     * event never reaches the editor at all.
     */
    function claim(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        claim(event);
        setOpen(false);
        return;
      }

      if (event.key === "ArrowDown") {
        claim(event);
        setIndex((i) => (i + 1) % Math.max(1, commands.length));
        return;
      }

      if (event.key === "ArrowUp") {
        claim(event);
        setIndex((i) => (i - 1 + commands.length) % Math.max(1, commands.length));
        return;
      }

      if ((event.key === "Enter" || event.key === "Tab") && commands.length > 0) {
        claim(event);
        select(commands[index]);
      }
    }

    // Capture phase on the document, so the palette claims these keys before
    // they reach the editor at all.
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, commands, index]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  function select(command: SlashCommand) {
    const from = triggerRef.current;

    setOpen(false);
    setQuery("");
    triggerRef.current = null;

    // Remove the "/query" first — it is document text, and leaving it behind
    // would put the trigger into the finished answer.
    if (from !== null) {
      editor.chain().focus().deleteRange({ from, to: editor.state.selection.from }).run();
    }

    command.run(editor);
    onCommand(command);
  }

  if (!open || !position) return null;

  return (
    <div
      role="listbox"
      aria-label="Insert block"
      className="fixed z-50 max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-[var(--shadow-overlay)]"
      style={{ top: position.top, left: position.left }}
      ref={listRef}
    >
      {commands.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          No blocks match “{query}”
        </p>
      ) : (
        groupBy(commands).map(([group, items]) => (
          <div key={group}>
            <p className="px-2 pb-1 pt-2 text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground/70">
              {group}
            </p>

            {items.map((command) => {
              const position = commands.indexOf(command);
              const active = position === index;
              const Icon = command.icon;

              return (
                <button
                  key={command.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-index={position}
                  // pointerdown, not click: the editor would lose focus on
                  // mousedown and the caret position with it.
                  onPointerDown={(event) => {
                    event.preventDefault();
                    select(command);
                  }}
                  onPointerEnter={() => setIndex(position)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start transition-colors",
                    active ? "bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded border border-border bg-card">
                    <Icon className="size-3.5" aria-hidden />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-tight">
                      {command.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {command.description}
                    </span>
                  </span>

                  {command.shortcut ? (
                    <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-[family-name:var(--font-mono-code)] text-[0.625rem] text-muted-foreground">
                      {command.shortcut}
                    </kbd>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

function groupBy(commands: SlashCommand[]): Array<[string, SlashCommand[]]> {
  const groups = new Map<string, SlashCommand[]>();

  for (const command of commands) {
    const existing = groups.get(command.group);
    if (existing) existing.push(command);
    else groups.set(command.group, [command]);
  }

  return [...groups.entries()];
}
