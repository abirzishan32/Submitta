/**
 * Mirrors the API's SubmissionEventType.
 *
 * Named rather than numbered, because that is how the API serialises enums —
 * comparing a response's `"Insert"` against a numeric 2 silently matches
 * nothing. The API accepts either form on the way in, so the same names are
 * what the recorder sends.
 */
export const EventType = {
  DocumentOpen: "DocumentOpen",
  Insert: "Insert",
  Delete: "Delete",
  Paste: "Paste",
  Cut: "Cut",
  Format: "Format",
  BlockChange: "BlockChange",
  NodeInsert: "NodeInsert",
  NodeDelete: "NodeDelete",
  BlockMove: "BlockMove",
  Undo: "Undo",
  Redo: "Redo",
  SelectionChange: "SelectionChange",
  Idle: "Idle",
  FocusLost: "FocusLost",
  FocusRegained: "FocusRegained",
  AutoSave: "AutoSave",
  ManualSave: "ManualSave",
  Submit: "Submit",
  DocumentClose: "DocumentClose",
} as const;

export type EventTypeValue = (typeof EventType)[keyof typeof EventType];

/** Human labels for the replay timeline. */
export const EVENT_LABELS: Record<string, string> = {
  [EventType.DocumentOpen]: "Opened",
  [EventType.Insert]: "Typing",
  [EventType.Delete]: "Deleted",
  [EventType.Paste]: "Pasted",
  [EventType.Cut]: "Cut",
  [EventType.Format]: "Formatting",
  [EventType.BlockChange]: "Block changed",
  [EventType.NodeInsert]: "Inserted",
  [EventType.NodeDelete]: "Removed",
  [EventType.BlockMove]: "Moved",
  [EventType.Undo]: "Undo",
  [EventType.Redo]: "Redo",
  [EventType.SelectionChange]: "Moved cursor",
  [EventType.Idle]: "Paused",
  [EventType.FocusLost]: "Left the tab",
  [EventType.FocusRegained]: "Returned",
  [EventType.AutoSave]: "Auto-saved",
  [EventType.ManualSave]: "Saved",
  [EventType.Submit]: "Submitted",
  [EventType.DocumentClose]: "Closed",
};

/** Resume state for reopening a document. */
export interface EditorSession {
  submissionId: string;
  contentJson: string | null;
  plainText: string;
  lastSequence: number;
  lastOffsetMs: number;
  editable: boolean;
}

export interface ReplayEvent {
  sequence: number;
  type: EventTypeValue;
  offsetMs: number;
  blockId: string | null;
  cursorFrom: number | null;
  cursorTo: number | null;
  payload: string | null;
  charactersAdded: number;
  charactersRemoved: number;
  pastedWords: number;
}

export interface PasteIncident {
  sequence: number;
  offsetMs: number;
  words: number;
  characters: number;
  preview: string | null;
}

export interface WritingAnalytics {
  totalDurationMs: number;
  activeWritingMs: number;
  idleMs: number;
  wordsTyped: number;
  wordsPasted: number;
  pastePercentage: number;
  typingSpeedWpm: number;
  charactersTyped: number;
  charactersDeleted: number;
  deleteCount: number;
  undoCount: number;
  redoCount: number;
  pasteCount: number;
  largestPasteWords: number;
  imagesInserted: number;
  tablesInserted: number;
  codeBlocksInserted: number;
  equationsInserted: number;
  averagePauseMs: number;
  longestPauseMs: number;
  sessionCount: number;
  focusLostCount: number;
  firstEditAt: string | null;
  lastEditAt: string | null;
  largePastes: PasteIncident[];
}

export interface ReplayDto {
  submissionId: string;
  studentName: string;
  assignmentTitle: string;
  finalContentJson: string | null;
  totalDurationMs: number;
  eventCount: number;
  events: ReplayEvent[];
  analytics: WritingAnalytics;
}

export interface SubmissionVersion {
  id: string;
  versionNumber: number;
  wordCount: number;
  reason: string;
  atSequence: number;
  createdAt: string;
}
