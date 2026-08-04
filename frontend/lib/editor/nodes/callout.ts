import { Node, mergeAttributes } from "@tiptap/core";

export type CalloutTone = "note" | "tip" | "warning" | "danger";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (tone?: CalloutTone) => ReturnType;
      toggleCallout: (tone?: CalloutTone) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

/**
 * A callout block: an aside that carries a tone.
 *
 * Defined as a real node rather than a styled blockquote so the tone survives
 * a round trip through JSON, and so the replay can report "callout inserted"
 * rather than "blockquote with a class".
 *
 * `content: "block+"` lets a callout hold lists and code, which is what
 * students actually put in them.
 */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: "note" as CalloutTone,
        parseHTML: (element) => element.getAttribute("data-tone") ?? "note",
        renderHTML: (attributes) => ({ "data-tone": attributes.tone }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout", class: "editor-callout" }),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (tone = "note") =>
        ({ commands }) =>
          commands.wrapIn(this.name, { tone }),

      toggleCallout:
        (tone = "note") =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { tone }),

      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      // Mirrors Tiptap's blockquote shortcut, shifted by one modifier.
      "Mod-Shift-c": () => this.editor.commands.toggleCallout(),
    };
  },
});
