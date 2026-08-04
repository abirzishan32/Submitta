import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";

import { EventType, type EventTypeValue } from "@/lib/api/editor-types";

/**
 * Records editing operations as a structured log.
 *
 * Reads ProseMirror transactions rather than DOM or key events: a transaction
 * already describes *what changed* as a set of steps, so the log is precise
 * without guessing intent from keystrokes. That is also why the replay can
 * reconstruct the document exactly — it replays the same operations.
 *
 * Two decisions keep the log small enough to store and stream:
 *
 * - **Consecutive typing is coalesced.** A run of characters in one place
 *   becomes one event carrying the run, flushed when the caret moves, the run
 *   grows past a threshold, or typing pauses. A 2,000-word essay lands in the
 *   low thousands of events rather than tens of thousands. The player
 *   interpolates within a run, so playback is still character-by-character.
 *
 * - **Events are batched to the server.** One request per keystroke would be
 *   hundreds a minute per student.
 */

// One definition shared with the replay side: the recorder writes these and the
// player reads them back, so a second copy is a divergence waiting to happen.
export { EventType, type EventTypeValue };

export interface RecordedEvent {
  sequence: number;
  type: EventTypeValue;
  offsetMs: number;
  sessionId: string;
  cursorFrom: number | null;
  cursorTo: number | null;
  blockId: string | null;
  payload: string | null;
  charactersAdded: number;
  charactersRemoved: number;
  pastedWords: number;
}

/** Typing runs longer than this are flushed, so no single event is unbounded. */
const MAX_RUN_LENGTH = 60;

/** A gap this long ends the current typing run. */
const RUN_IDLE_MS = 1_500;

/** No activity for this long emits an Idle event, which drives pause analytics. */
const IDLE_THRESHOLD_MS = 30_000;

interface PendingRun {
  type: typeof EventType.Insert | typeof EventType.Delete;
  text: string;
  from: number;
  blockId: string | null;
  startedAt: number;
}

export class EditingRecorder {
  private events: RecordedEvent[] = [];
  private sequence = 0;
  private run: PendingRun | null = null;
  private runTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivityAt: number;

  /** Set when the next transaction is known to come from the clipboard. */
  private pasteHint: { text: string; html: boolean } | null = null;
  private cutHint = false;

  /** The last transaction interpreted, so the same one is never counted twice. */
  private lastTransaction: Transaction | null = null;

  readonly sessionId: string;
  private readonly startedAt: number;

  constructor(
    /** Resumes numbering after a reload so sequences stay unique per submission. */
    startSequence = 0,
    /**
     * Milliseconds already elapsed in earlier sittings. Keeps the replay a
     * single continuous timeline across days.
     */
    private readonly baseOffsetMs = 0,
  ) {
    this.sequence = startSequence;
    this.sessionId = crypto.randomUUID();
    this.startedAt = Date.now();
    this.lastActivityAt = this.startedAt;
  }

  private offset(): number {
    return this.baseOffsetMs + (Date.now() - this.startedAt);
  }

  private push(
    type: EventTypeValue,
    partial: Partial<Omit<RecordedEvent, "sequence" | "type" | "offsetMs" | "sessionId">> = {},
  ) {
    this.events.push({
      sequence: ++this.sequence,
      type,
      offsetMs: this.offset(),
      sessionId: this.sessionId,
      cursorFrom: partial.cursorFrom ?? null,
      cursorTo: partial.cursorTo ?? null,
      blockId: partial.blockId ?? null,
      payload: partial.payload ?? null,
      charactersAdded: partial.charactersAdded ?? 0,
      charactersRemoved: partial.charactersRemoved ?? 0,
      pastedWords: partial.pastedWords ?? 0,
    });

    this.markActive();
  }

  private markActive() {
    this.lastActivityAt = Date.now();

    if (this.idleTimer) clearTimeout(this.idleTimer);

    this.idleTimer = setTimeout(() => {
      // Emitted at the moment the gap becomes a pause, carrying how long it
      // has been — the server derives pause statistics from these.
      this.push(EventType.Idle, {
        payload: JSON.stringify({ afterMs: IDLE_THRESHOLD_MS }),
      });
    }, IDLE_THRESHOLD_MS);
  }

  // --- Lifecycle ---------------------------------------------------------

  open(wordCount: number) {
    this.push(EventType.DocumentOpen, {
      payload: JSON.stringify({ wordCount, device: describeDevice() }),
    });
  }

  close() {
    this.flushRun();
    this.push(EventType.DocumentClose);
  }

  focusLost() {
    this.flushRun();
    this.push(EventType.FocusLost);
  }

  focusRegained() {
    this.push(EventType.FocusRegained);
  }

  saved(manual: boolean) {
    this.flushRun();
    this.push(manual ? EventType.ManualSave : EventType.AutoSave);
  }

  submitted(wordCount: number) {
    this.flushRun();
    this.push(EventType.Submit, { payload: JSON.stringify({ wordCount }) });
  }

  // --- Clipboard ---------------------------------------------------------

  /**
   * Called from the paste handler, before the transaction lands.
   *
   * The clipboard content is only available on the DOM event, so it is stashed
   * here and consumed by the transaction that follows.
   */
  notePaste(text: string, isHtml: boolean) {
    this.flushRun();
    this.pasteHint = { text, html: isHtml };
  }

  noteCut() {
    this.flushRun();
    this.cutHint = true;
  }

  // --- Transactions ------------------------------------------------------

  /**
   * Interprets one transaction.
   *
   * Order matters: clipboard hints are checked first, because a paste is also
   * an insertion and would otherwise be recorded as typing — which is exactly
   * the distinction this whole system exists to make.
   */
  handleTransaction(editor: Editor, transaction: Transaction) {
    // One transaction reaches us through both `update` and `selectionUpdate`,
    // because typing moves the caret as well as changing the document. Without
    // this guard every keystroke is logged twice and a paste is logged again as
    // typing — which would defeat the one distinction the log exists to make.
    if (this.lastTransaction === transaction) return;
    this.lastTransaction = transaction;

    const { from, to } = editor.state.selection;
    const blockId = currentBlockId(editor);

    if (!transaction.docChanged) {
      // Selection moves are recorded coarsely: the caret's exact path between
      // two clicks is noise, but where a student jumped to is not.
      if (transaction.selectionSet) {
        this.flushRun();
        this.push(EventType.SelectionChange, { cursorFrom: from, cursorTo: to, blockId });
      }
      return;
    }

    const { added, removed } = measure(transaction);

    if (this.pasteHint) {
      const { text, html } = this.pasteHint;
      this.pasteHint = null;

      const words = countWords(text);

      this.push(EventType.Paste, {
        cursorFrom: from,
        cursorTo: to,
        blockId,
        charactersAdded: text.length,
        pastedWords: words,
        payload: JSON.stringify({
          // Capped: this is evidence of what arrived, not a second copy of it.
          text: text.slice(0, 400),
          truncated: text.length > 400,
          characters: text.length,
          words,
          html,
        }),
      });
      return;
    }

    if (this.cutHint) {
      this.cutHint = false;
      this.push(EventType.Cut, {
        cursorFrom: from,
        blockId,
        charactersRemoved: removed,
      });
      return;
    }

    // A structural node arriving — table, image, code block, callout.
    const inserted = insertedNodeTypes(transaction);
    if (inserted.length > 0) {
      this.flushRun();
      this.push(EventType.NodeInsert, {
        cursorFrom: from,
        blockId,
        payload: JSON.stringify({ nodes: inserted }),
        charactersAdded: added,
      });
      return;
    }

    if (added > 0 && removed === 0) {
      this.appendToRun(EventType.Insert, insertedText(transaction), from, blockId);
      return;
    }

    if (removed > 0 && added === 0) {
      this.appendToRun(EventType.Delete, "", from, blockId, removed);
      return;
    }

    // A replacement — typing over a selection, or a find-and-replace.
    this.flushRun();
    this.push(EventType.Insert, {
      cursorFrom: from,
      blockId,
      charactersAdded: added,
      charactersRemoved: removed,
      payload: JSON.stringify({ text: insertedText(transaction).slice(0, 200) }),
    });
  }

  /** Records a formatting change, which carries no document text. */
  formatted(editor: Editor, mark: string, active: boolean) {
    this.flushRun();
    const { from, to } = editor.state.selection;

    this.push(EventType.Format, {
      cursorFrom: from,
      cursorTo: to,
      blockId: currentBlockId(editor),
      payload: JSON.stringify({ mark, active }),
    });
  }

  blockChanged(editor: Editor, to: string, attrs?: Record<string, unknown>) {
    this.flushRun();

    this.push(EventType.BlockChange, {
      cursorFrom: editor.state.selection.from,
      blockId: currentBlockId(editor),
      payload: JSON.stringify({ to, ...attrs }),
    });
  }

  historyStep(editor: Editor, redo: boolean) {
    this.flushRun();
    this.push(redo ? EventType.Redo : EventType.Undo, {
      cursorFrom: editor.state.selection.from,
      blockId: currentBlockId(editor),
    });
  }

  // --- Typing runs -------------------------------------------------------

  private appendToRun(
    type: typeof EventType.Insert | typeof EventType.Delete,
    text: string,
    from: number,
    blockId: string | null,
    removed = 0,
  ) {
    const contiguous =
      this.run !== null &&
      this.run.type === type &&
      this.run.blockId === blockId &&
      Math.abs(from - this.run.from - this.run.text.length) <= 2;

    if (!contiguous) {
      this.flushRun();
      this.run = { type, text: "", from, blockId, startedAt: Date.now() };
    }

    const run = this.run!;
    run.text += text;

    if (type === EventType.Delete) {
      // Deletions have no text to accumulate, so length stands in for count.
      run.text += " ".repeat(Math.max(0, removed - text.length));
    }

    if (this.runTimer) clearTimeout(this.runTimer);
    this.runTimer = setTimeout(() => this.flushRun(), RUN_IDLE_MS);

    if (run.text.length >= MAX_RUN_LENGTH) this.flushRun();

    this.markActive();
  }

  /** Emits the pending run as one event. Safe to call when there is none. */
  flushRun() {
    if (this.runTimer) {
      clearTimeout(this.runTimer);
      this.runTimer = null;
    }

    const run = this.run;
    if (!run) return;
    this.run = null;

    if (run.type === EventType.Insert) {
      this.push(EventType.Insert, {
        cursorFrom: run.from,
        blockId: run.blockId,
        charactersAdded: run.text.length,
        payload: JSON.stringify({
          text: run.text,
          durationMs: Date.now() - run.startedAt,
        }),
      });
    } else {
      this.push(EventType.Delete, {
        cursorFrom: run.from,
        blockId: run.blockId,
        charactersRemoved: run.text.length,
      });
    }
  }

  // --- Draining ----------------------------------------------------------

  /**
   * Hands over everything recorded so far and clears the buffer.
   *
   * The caller owns delivery: if the request fails it should hand the events
   * back with {@link restore} rather than losing them.
   */
  drain(): RecordedEvent[] {
    this.flushRun();
    const batch = this.events;
    this.events = [];
    return batch;
  }

  /** Returns undelivered events to the front of the buffer, preserving order. */
  restore(events: RecordedEvent[]) {
    this.events = [...events, ...this.events];
  }

  get pending(): number {
    return this.events.length + (this.run ? 1 : 0);
  }

  get lastSequence(): number {
    return this.sequence;
  }

  dispose() {
    if (this.runTimer) clearTimeout(this.runTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }
}

// ---------------------------------------------------------------------------

/** Characters added and removed across a transaction's steps. */
function measure(transaction: Transaction): { added: number; removed: number } {
  let added = 0;
  let removed = 0;

  for (const step of transaction.steps) {
    const map = step.getMap();
    map.forEach((_oldStart, oldEnd, newStart, newEnd) => {
      removed += oldEnd - _oldStart;
      added += newEnd - newStart;
    });
  }

  return { added, removed };
}

function insertedText(transaction: Transaction): string {
  let text = "";

  for (const step of transaction.steps) {
    const slice = (step as unknown as { slice?: { content?: { textBetween?: unknown } } }).slice;
    if (slice?.content && typeof (slice.content as { size?: number }).size === "number") {
      const content = slice.content as unknown as {
        size: number;
        textBetween: (from: number, to: number, sep?: string) => string;
      };
      if (content.size > 0) text += content.textBetween(0, content.size, "");
    }
  }

  return text;
}

/** Names of non-text nodes introduced by a transaction. */
function insertedNodeTypes(transaction: Transaction): string[] {
  const types = new Set<string>();

  for (const step of transaction.steps) {
    const slice = (step as unknown as { slice?: { content?: unknown } }).slice;
    const content = slice?.content as
      | { descendants?: (fn: (node: { type: { name: string }; isText: boolean }) => void) => void }
      | undefined;

    content?.descendants?.((node) => {
      if (!node.isText && node.type.name !== "text" && node.type.name !== "paragraph") {
        types.add(node.type.name);
      }
    });
  }

  return [...types];
}

function currentBlockId(editor: Editor): string | null {
  const { $from } = editor.state.selection;

  for (let depth = $from.depth; depth > 0; depth--) {
    const id = $from.node(depth).attrs?.blockId;
    if (typeof id === "string") return id;
  }

  return null;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Coarse device description for the submission record.
 *
 * Platform and viewport only — enough to distinguish "written on a phone" from
 * "written on a desktop", without assembling a fingerprint.
 */
function describeDevice(): Record<string, unknown> {
  if (typeof window === "undefined") return {};

  return {
    platform: navigator.platform,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
