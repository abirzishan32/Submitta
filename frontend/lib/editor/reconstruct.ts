import { EventType, type ReplayEvent } from "@/lib/api/editor-types";

export interface Reconstruction {
  text: string;
  /** Half-open [start, end) ranges of text that arrived by paste. */
  pastedRanges: Array<[number, number]>;
}

/**
 * Rebuilds the plain text after a run of events, tracking what was pasted.
 *
 * Text only. Reproducing the formatted document as it stood at each moment
 * would mean re-implementing ProseMirror's transform pipeline in the player;
 * text is what reveals *how* something was written, which is the question a
 * replay answers. The finished document is shown in full alongside it.
 *
 * Rebuilt from scratch for each position rather than incrementally: it is a
 * linear pass over a few thousand small operations, and it makes seeking
 * backwards cost exactly what seeking forwards costs. An incremental model
 * would need an inverse for every operation.
 */
export function reconstruct(events: ReplayEvent[]): Reconstruction {
  let text = "";
  const pasted: Array<[number, number]> = [];

  for (const event of events) {
    switch (event.type) {
      case EventType.Insert: {
        text += textOf(event) || " ".repeat(event.charactersAdded);
        break;
      }

      case EventType.Paste: {
        const content = textOf(event) || " ".repeat(event.charactersAdded);
        pasted.push([text.length, text.length + content.length]);
        text += content;
        break;
      }

      case EventType.Delete:
      case EventType.Cut: {
        const keep = Math.max(0, text.length - event.charactersRemoved);

        // Ranges that the deletion ate into have to shrink with it, or a later
        // paste marker would highlight text that is no longer the pasted text.
        for (let i = pasted.length - 1; i >= 0; i--) {
          const [start, end] = pasted[i];
          if (start >= keep) pasted.splice(i, 1);
          else if (end > keep) pasted[i] = [start, keep];
        }

        text = text.slice(0, keep);
        break;
      }

      case EventType.NodeInsert: {
        // Structural nodes carry no text of their own; a break keeps the
        // reconstruction honest that something was inserted here.
        text += "\n";
        break;
      }

      case EventType.BlockChange: {
        text += "\n";
        break;
      }

      default:
        break;
    }
  }

  return { text, pastedRanges: pasted };
}

/**
 * The text an event carried.
 *
 * The payload is stored as jsonb, so it comes back in PostgreSQL's normalised
 * form rather than as the editor wrote it — it has to be parsed, not matched.
 */
function textOf(event: ReplayEvent): string {
  if (!event.payload) return "";

  try {
    const parsed = JSON.parse(event.payload) as { text?: unknown };
    return typeof parsed.text === "string" ? parsed.text : "";
  } catch {
    return "";
  }
}
