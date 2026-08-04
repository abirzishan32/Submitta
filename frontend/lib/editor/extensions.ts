import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextStyle, Color, BackgroundColor } from "@tiptap/extension-text-style";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import CharacterCount from "@tiptap/extension-character-count";
import Image from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Placeholder } from "@tiptap/extensions";
import { createLowlight, common } from "lowlight";

import { Callout } from "./nodes/callout";
import { BlockId } from "./nodes/block-id";

/**
 * Syntax highlighting registry.
 *
 * `common` covers roughly forty languages including every one the brief asks
 * for. Registering the full set instead would roughly triple the bundle for
 * languages a coursework submission will not contain.
 */
const lowlight = createLowlight(common);

/** Languages offered in the code block's selector, in the order shown. */
export const CODE_LANGUAGES = [
  { value: "plaintext", label: "Plain text" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "bash", label: "Shell" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
] as const;

/**
 * The editor's schema.
 *
 * Assembled from Tiptap's extension system rather than hand-managed state: the
 * document is a ProseMirror tree, so every operation is already a structured
 * transaction. That is what makes the replay log possible — the recorder reads
 * transactions rather than trying to infer intent from keystrokes.
 */
export function buildExtensions(options: { placeholder?: string } = {}) {
  return [
    StarterKit.configure({
      // Replaced below with the syntax-highlighting variant.
      codeBlock: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: {
        openOnClick: false,
        autolink: true,
        // A submission is untrusted content a teacher will read. Restricting
        // schemes stops a link from carrying javascript: or data:.
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),

    CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }),

    // Separate package in v3 — StarterKit does not bundle it.
    Placeholder.configure({
      placeholder: options.placeholder ?? "Write your answer, or press / for commands…",
    }),

    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    BackgroundColor,
    Subscript,
    Superscript,
    TextAlign.configure({ types: ["heading", "paragraph"] }),

    TaskList,
    TaskItem.configure({ nested: true }),

    Table.configure({ resizable: true, allowTableNodeSelection: true }),
    TableRow,
    TableHeader,
    TableCell,

    Image.configure({
      inline: false,
      allowBase64: true,
      HTMLAttributes: { class: "editor-image" },
    }),

    Callout,
    BlockId,

    // Counts are shown live in the header; the limit guards against a paste
    // large enough to break the payload rather than against long answers.
    CharacterCount.configure({ limit: 200_000 }),
  ];
}
