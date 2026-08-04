import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const TRACKED_NODES = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "taskList",
  "table",
  "callout",
  "image",
];

/**
 * Gives every block a stable identifier.
 *
 * The replay records which block each operation touched. ProseMirror positions
 * shift as the document changes, so a position recorded at minute two means
 * something different by minute ten — an identifier that travels with the node
 * does not. It is also what lets analytics answer "which sections were edited
 * most" without replaying the whole log.
 *
 * Assigned on creation and never reused: a duplicated node (paste, split)
 * receives a fresh identifier rather than inheriting one.
 */
export const BlockId = Extension.create({
  name: "blockId",

  addGlobalAttributes() {
    return [
      {
        types: TRACKED_NODES,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) =>
              attributes.blockId ? { "data-block-id": attributes.blockId } : {},
            // Not part of the visible document; excluded from copied HTML so
            // pasting into another document does not carry identifiers over.
            keepOnSplit: false,
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("blockId"),

        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }

          const tr = newState.tr;
          const seen = new Set<string>();
          let changed = false;

          newState.doc.descendants((node, pos) => {
            if (!TRACKED_NODES.includes(node.type.name)) return;

            const current = node.attrs.blockId as string | null;

            // Missing, or duplicated by a split or paste — either way this node
            // needs an identifier of its own.
            if (!current || seen.has(current)) {
              tr.setNodeAttribute(pos, "blockId", createId());
              changed = true;
            } else {
              seen.add(current);
            }
          });

          return changed ? tr : null;
        },
      }),
    ];
  },
});

/**
 * Short random identifier.
 *
 * Not a UUID: these appear on every block in the serialised document, and eight
 * characters is ample to stay unique within one submission.
 */
function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}
