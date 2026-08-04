"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Subscript as SubIcon,
  Superscript as SupIcon,
  Underline as UnderlineIcon,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The formatting toolbar.
 *
 * Sticky rather than floating over the text: a bar that follows the selection
 * covers the line above it, which is exactly where a writer is looking. The
 * bubble menu is reserved for link editing, where the target is unambiguous.
 *
 * Every action reports back through `onAction`, so the recorder logs it as a
 * formatting operation rather than inferring one from the resulting document.
 */
export function EditorToolbar({
  editor,
  onAction,
  className,
}: {
  editor: Editor;
  onAction: (mark: string, active: boolean) => void;
  className?: string;
}) {
  function toggle(mark: string, run: () => boolean) {
    run();
    onAction(mark, editor.isActive(mark));
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-0.5 border-b border-border bg-background/90 px-2 py-1.5 backdrop-blur-sm",
        className,
      )}
      role="toolbar"
      aria-label="Formatting"
    >
      <Action
        icon={Undo2}
        label="Undo"
        shortcut="⌘Z"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <Action
        icon={Redo2}
        label="Redo"
        shortcut="⌘⇧Z"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />

      <Divider />

      {/* Block type. A select rather than six buttons — heading level is one
          choice, not six independent toggles. */}
      <select
        aria-label="Block type"
        value={currentBlock(editor)}
        onChange={(event) => {
          const value = event.target.value;
          const chain = editor.chain().focus();

          if (value === "paragraph") chain.setParagraph().run();
          else chain.setNode("heading", { level: Number(value) }).run();

          onAction(`block:${value}`, true);
        }}
        className="h-7 rounded-md border border-border bg-transparent px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <option value="paragraph">Text</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
        <option value="4">Heading 4</option>
      </select>

      <Divider />

      <Action
        icon={Bold}
        label="Bold"
        shortcut="⌘B"
        active={editor.isActive("bold")}
        onClick={() => toggle("bold", () => editor.chain().focus().toggleBold().run())}
      />
      <Action
        icon={Italic}
        label="Italic"
        shortcut="⌘I"
        active={editor.isActive("italic")}
        onClick={() => toggle("italic", () => editor.chain().focus().toggleItalic().run())}
      />
      <Action
        icon={UnderlineIcon}
        label="Underline"
        shortcut="⌘U"
        active={editor.isActive("underline")}
        onClick={() =>
          toggle("underline", () => editor.chain().focus().toggleUnderline().run())
        }
      />
      <Action
        icon={Strikethrough}
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => toggle("strike", () => editor.chain().focus().toggleStrike().run())}
      />
      <Action
        icon={Highlighter}
        label="Highlight"
        active={editor.isActive("highlight")}
        onClick={() =>
          toggle("highlight", () => editor.chain().focus().toggleHighlight().run())
        }
      />

      <Divider />

      <Action
        icon={SupIcon}
        label="Superscript"
        active={editor.isActive("superscript")}
        onClick={() =>
          toggle("superscript", () => editor.chain().focus().toggleSuperscript().run())
        }
      />
      <Action
        icon={SubIcon}
        label="Subscript"
        active={editor.isActive("subscript")}
        onClick={() =>
          toggle("subscript", () => editor.chain().focus().toggleSubscript().run())
        }
      />
      <Action
        icon={Code}
        label="Inline code"
        shortcut="⌘E"
        active={editor.isActive("code")}
        onClick={() => toggle("code", () => editor.chain().focus().toggleCode().run())}
      />

      <Divider />

      <Action
        icon={List}
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() =>
          toggle("bulletList", () => editor.chain().focus().toggleBulletList().run())
        }
      />
      <Action
        icon={ListOrdered}
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() =>
          toggle("orderedList", () => editor.chain().focus().toggleOrderedList().run())
        }
      />

      <Divider />

      <Action
        icon={Link2}
        label="Link"
        shortcut="⌘K"
        active={editor.isActive("link")}
        onClick={() => {
          const existing = editor.getAttributes("link").href as string | undefined;
          const href = window.prompt("Link URL", existing ?? "https://");

          // Cancel leaves the document untouched; clearing the field removes it.
          if (href === null) return;

          if (href === "") {
            editor.chain().focus().unsetLink().run();
            onAction("link", false);
            return;
          }

          editor.chain().focus().setLink({ href }).run();
          onAction("link", true);
        }}
      />

      {/* Colour. A native input, because a bespoke picker is a lot of surface
          for something the OS already does well. */}
      <label
        className="flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent"
        title="Text colour"
      >
        <span
          className="size-3.5 rounded-full border border-border"
          style={{ background: (editor.getAttributes("textStyle").color as string) ?? "currentColor" }}
        />
        <input
          type="color"
          className="sr-only"
          aria-label="Text colour"
          onChange={(event) => {
            editor.chain().focus().setColor(event.target.value).run();
            onAction("color", true);
          }}
        />
      </label>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  shortcut,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} · ${shortcut}` : label}
      disabled={disabled}
      // The editor must keep focus and its selection — a toolbar that blurs
      // the document applies formatting to nothing.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-border" />;
}

function currentBlock(editor: Editor): string {
  for (const level of [1, 2, 3, 4, 5, 6]) {
    if (editor.isActive("heading", { level })) return String(level);
  }
  return "paragraph";
}
