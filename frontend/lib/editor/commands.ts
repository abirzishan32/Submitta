import type { Editor } from "@tiptap/react";
import {
  AlignLeft,
  CheckSquare,
  Code2,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sigma,
  Table as TableIcon,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  shortcut?: string;
  group: "Basic" | "Lists" | "Blocks" | "Academic" | "Media";
  /** Words that should also match this command when searching. */
  keywords: string[];
  run: (editor: Editor) => void;
}

/**
 * The slash palette's commands.
 *
 * Data rather than JSX so the same list drives the palette, the toolbar's
 * overflow menu and the keyboard-shortcut sheet — three hand-maintained copies
 * is how a command menu drifts out of sync with what the editor can do.
 *
 * Each `run` deletes the trigger text before acting, since the "/query" the
 * user typed is still in the document at that point.
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "heading1",
    label: "Heading 1",
    description: "Top-level section title",
    icon: Heading1,
    shortcut: "⌘⌥1",
    group: "Basic",
    keywords: ["h1", "title", "large"],
    run: (editor) => editor.chain().focus().setNode("heading", { level: 1 }).run(),
  },
  {
    id: "heading2",
    label: "Heading 2",
    description: "Section heading",
    icon: Heading2,
    shortcut: "⌘⌥2",
    group: "Basic",
    keywords: ["h2", "subtitle"],
    run: (editor) => editor.chain().focus().setNode("heading", { level: 2 }).run(),
  },
  {
    id: "heading3",
    label: "Heading 3",
    description: "Sub-section heading",
    icon: Heading3,
    shortcut: "⌘⌥3",
    group: "Basic",
    keywords: ["h3"],
    run: (editor) => editor.chain().focus().setNode("heading", { level: 3 }).run(),
  },
  {
    id: "paragraph",
    label: "Text",
    description: "Plain paragraph",
    icon: AlignLeft,
    group: "Basic",
    keywords: ["p", "body", "normal"],
    run: (editor) => editor.chain().focus().setParagraph().run(),
  },

  {
    id: "bulletList",
    label: "Bulleted list",
    description: "An unordered list",
    icon: List,
    shortcut: "⌘⇧8",
    group: "Lists",
    keywords: ["ul", "unordered", "point"],
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "orderedList",
    label: "Numbered list",
    description: "An ordered list",
    icon: ListOrdered,
    shortcut: "⌘⇧7",
    group: "Lists",
    keywords: ["ol", "ordered", "number"],
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "checklist",
    label: "Checklist",
    description: "A list with checkboxes",
    icon: CheckSquare,
    shortcut: "⌘⇧9",
    group: "Lists",
    keywords: ["todo", "task", "tick"],
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },

  {
    id: "quote",
    label: "Quote",
    description: "Set text apart as a quotation",
    icon: Quote,
    shortcut: "⌘⇧B",
    group: "Blocks",
    keywords: ["blockquote", "citation"],
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "callout",
    label: "Callout",
    description: "Highlight a note or warning",
    icon: Info,
    shortcut: "⌘⇧C",
    group: "Blocks",
    keywords: ["note", "aside", "warning", "tip"],
    run: (editor) => editor.chain().focus().toggleCallout("note").run(),
  },
  {
    id: "code",
    label: "Code block",
    description: "Syntax-highlighted code",
    icon: Code2,
    shortcut: "⌘⌥C",
    group: "Blocks",
    keywords: ["snippet", "program", "pseudocode", "algorithm"],
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "table",
    label: "Table",
    description: "A 3×3 table with a header row",
    icon: TableIcon,
    group: "Blocks",
    keywords: ["grid", "rows", "columns"],
    run: (editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    id: "divider",
    label: "Divider",
    description: "A horizontal rule",
    icon: Minus,
    group: "Blocks",
    keywords: ["hr", "separator", "line"],
    run: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "columns",
    label: "Two columns",
    description: "Side-by-side content, as a two-cell table",
    icon: Columns3,
    group: "Blocks",
    keywords: ["split", "side by side", "layout"],
    // Implemented with a borderless table rather than a bespoke node: it gives
    // real column behaviour and survives export without a custom serialiser.
    run: (editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 1, cols: 2, withHeaderRow: false })
        .run(),
  },

  {
    id: "math",
    label: "Equation",
    description: "LaTeX, rendered inline",
    icon: Sigma,
    group: "Academic",
    keywords: ["latex", "formula", "maths", "equation", "scientific"],
    // A fenced block tagged `latex`, so the source is always recoverable and
    // the content round-trips through plain text.
    run: (editor) =>
      editor.chain().focus().toggleCodeBlock({ language: "latex" }).run(),
  },
  {
    id: "mermaid",
    label: "Diagram",
    description: "Mermaid flowchart or sequence diagram",
    icon: Workflow,
    group: "Academic",
    keywords: ["mermaid", "flowchart", "graph", "sequence", "uml"],
    run: (editor) =>
      editor.chain().focus().toggleCodeBlock({ language: "mermaid" }).run(),
  },
  {
    id: "citation",
    label: "Citation",
    description: "An inline reference marker",
    icon: Quote,
    group: "Academic",
    keywords: ["cite", "reference", "footnote", "bibliography", "source"],
    run: (editor) =>
      editor.chain().focus().insertContent("<sup>[1]</sup>").run(),
  },

  {
    id: "image",
    label: "Image",
    description: "Upload, paste or drag an image",
    icon: ImageIcon,
    group: "Media",
    keywords: ["picture", "photo", "screenshot", "figure", "diagram"],
    // Handled by the editor shell, which owns the file input.
    run: (editor) => editor.chain().focus().run(),
  },
];

/**
 * Filters commands by a query.
 *
 * Matches label, description and keywords, so "screenshot" finds Image and
 * "algorithm" finds the code block — searching only labels makes a palette
 * feel broken the moment someone uses their own word for something.
 */
export function filterCommands(query: string): SlashCommand[] {
  const term = query.trim().toLowerCase();
  if (!term) return SLASH_COMMANDS;

  return SLASH_COMMANDS.filter((command) =>
    [command.label, command.description, ...command.keywords]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
}
