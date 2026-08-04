import { EventType, type EventTypeValue, type ReplayEvent } from "@/lib/api/editor-types";

/**
 * Turns a raw event log into the series the charts draw.
 *
 * Kept as pure functions over the events, separate from any component: the same
 * derivation drives several charts, and a number that appears in two places has
 * to come from one calculation or the two will eventually disagree.
 */

/** A gap longer than this is a pause rather than thinking time. Matches the API. */
export const IDLE_THRESHOLD_MS = 30_000;

/**
 * Accepts an event however the API happened to serialise its type.
 *
 * The type arrives as a name (`"Insert"`), but a numeric form is also valid
 * JSON for the same enum. Normalising once here means a serialiser change
 * cannot silently blank the replay — every comparison downstream is against a
 * name, and an unrecognised value stays visible as "unknown" rather than
 * quietly matching nothing.
 */
const NUMERIC_TYPES: EventTypeValue[] = [
  EventType.DocumentOpen,
  EventType.Insert,
  EventType.Delete,
  EventType.Paste,
  EventType.Cut,
  EventType.Format,
  EventType.BlockChange,
  EventType.NodeInsert,
  EventType.NodeDelete,
  EventType.BlockMove,
  EventType.Undo,
  EventType.Redo,
  EventType.SelectionChange,
  EventType.Idle,
  EventType.FocusLost,
  EventType.FocusRegained,
  EventType.AutoSave,
  EventType.ManualSave,
  EventType.Submit,
  EventType.DocumentClose,
];

export function normaliseType(type: unknown): EventTypeValue | "Unknown" {
  if (typeof type === "string") {
    return NUMERIC_TYPES.includes(type as EventTypeValue)
      ? (type as EventTypeValue)
      : "Unknown";
  }

  if (typeof type === "number") {
    // The enum is one-based, matching the C# declaration.
    return NUMERIC_TYPES[type - 1] ?? "Unknown";
  }

  return "Unknown";
}

export function normaliseEvents(events: ReplayEvent[]): ReplayEvent[] {
  return events.map((event) => ({ ...event, type: normaliseType(event.type) as EventTypeValue }));
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

export interface ProgressPoint {
  offsetMs: number;
  /** Words present in the document at this moment. */
  total: number;
  /** How many of those were typed. */
  typed: number;
  /** How many arrived by paste. */
  pasted: number;
}

/**
 * The document's word count over time, split by how the words got there.
 *
 * This is the chart that answers the question a teacher actually has. Typing
 * climbs gradually; a paste is a vertical step. The shape of the line says more
 * than any percentage.
 */
export function progressSeries(events: ReplayEvent[]): ProgressPoint[] {
  const points: ProgressPoint[] = [{ offsetMs: 0, total: 0, typed: 0, pasted: 0 }];

  let typed = 0;
  let pasted = 0;

  for (const event of events) {
    switch (event.type) {
      case EventType.Insert:
        // Five characters to a word is the usual convention, and the same one
        // the API uses — the two must agree or the chart will contradict the
        // figure printed beside it.
        typed += event.charactersAdded / 5;
        break;

      case EventType.Paste:
        pasted += event.pastedWords;
        break;

      case EventType.Delete:
      case EventType.Cut: {
        // Deletions come off the typed total first: a student trimming their
        // own sentence is the common case, and attributing it to pasted text
        // would flatter the numbers.
        const removed = event.charactersRemoved / 5;
        const fromTyped = Math.min(typed, removed);
        typed -= fromTyped;
        pasted = Math.max(0, pasted - (removed - fromTyped));
        break;
      }

      default:
        continue;
    }

    points.push({
      offsetMs: event.offsetMs,
      total: Math.round(typed + pasted),
      typed: Math.round(typed),
      pasted: Math.round(pasted),
    });
  }

  return points;
}

export interface SpeedBucket {
  startMs: number;
  endMs: number;
  /** Words per minute typed in this bucket. Excludes pasted words. */
  wpm: number;
  pastedWords: number;
  idle: boolean;
}

/**
 * Typing speed over time, in fixed buckets.
 *
 * Bucketed rather than per-event because event spacing is uneven — a run of
 * sixty characters and a single keystroke are both one event, and plotting
 * those directly would show noise rather than pace.
 */
export function speedSeries(events: ReplayEvent[], bucketCount = 32): SpeedBucket[] {
  const duration = events.length > 0 ? events[events.length - 1].offsetMs : 0;
  if (duration <= 0) return [];

  // Never narrower than a few seconds. A one-second window turns a single
  // coalesced run into a four-figure words-per-minute spike — arithmetically
  // right, and a useless thing to show a teacher.
  const size = Math.max(5_000, Math.ceil(duration / bucketCount));
  const buckets: SpeedBucket[] = [];

  for (let start = 0; start < duration; start += size) {
    buckets.push({
      startMs: start,
      endMs: start + size,
      wpm: 0,
      pastedWords: 0,
      idle: true,
    });
  }

  if (buckets.length === 0) return [];

  for (const event of events) {
    const index = Math.min(buckets.length - 1, Math.floor(event.offsetMs / size));
    const bucket = buckets[index];

    if (event.type === EventType.Insert) {
      bucket.wpm += event.charactersAdded / 5;
      bucket.idle = false;
    } else if (event.type === EventType.Paste) {
      bucket.pastedWords += event.pastedWords;
      bucket.idle = false;
    } else if (event.type !== EventType.Idle) {
      bucket.idle = false;
    }
  }

  const minutesPerBucket = size / 60_000;

  return buckets.map((bucket) => ({
    ...bucket,
    wpm: Math.round(bucket.wpm / minutesPerBucket),
  }));
}

export type BandKind = "typing" | "paste" | "revising" | "idle" | "away";

export interface ActivityBand {
  startMs: number;
  endMs: number;
  kind: BandKind;
}

/**
 * The session as a strip of coloured bands — what was happening, when.
 *
 * Adjacent bands of the same kind are merged, so the strip reads as phases of
 * work rather than as one sliver per event.
 */
export function activityBands(events: ReplayEvent[]): ActivityBand[] {
  if (events.length === 0) return [];

  const bands: ActivityBand[] = [];
  let away = false;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const next = events[i + 1];
    const endMs = next ? next.offsetMs : event.offsetMs;

    if (event.type === EventType.FocusLost) away = true;
    if (event.type === EventType.FocusRegained) away = false;

    let kind: BandKind;

    if (away) {
      kind = "away";
    } else if (endMs - event.offsetMs > IDLE_THRESHOLD_MS) {
      kind = "idle";
    } else {
      switch (event.type) {
        case EventType.Paste:
          kind = "paste";
          break;
        case EventType.Insert:
        case EventType.NodeInsert:
          kind = "typing";
          break;
        case EventType.Delete:
        case EventType.Cut:
        case EventType.Undo:
        case EventType.Redo:
          kind = "revising";
          break;
        case EventType.Idle:
          kind = "idle";
          break;
        default:
          kind = bands.length > 0 ? bands[bands.length - 1].kind : "idle";
      }
    }

    const last = bands[bands.length - 1];

    // A paste is a moment rather than a stretch, so it always gets its own band
    // — merging it into surrounding typing would hide it.
    if (last && last.kind === kind && kind !== "paste") {
      last.endMs = endMs;
    } else {
      bands.push({ startMs: event.offsetMs, endMs, kind });
    }
  }

  return bands;
}

export interface EventMixSlice {
  label: string;
  count: number;
  kind: BandKind;
}

/** What the student spent their actions on, for the mix chart. */
export function eventMix(events: ReplayEvent[]): EventMixSlice[] {
  const counts = {
    typing: 0,
    paste: 0,
    revising: 0,
    idle: 0,
    away: 0,
  } satisfies Record<BandKind, number>;

  for (const event of events) {
    switch (event.type) {
      case EventType.Insert:
      case EventType.NodeInsert:
      case EventType.BlockChange:
      case EventType.Format:
        counts.typing++;
        break;
      case EventType.Paste:
        counts.paste++;
        break;
      case EventType.Delete:
      case EventType.Cut:
      case EventType.Undo:
      case EventType.Redo:
        counts.revising++;
        break;
      case EventType.Idle:
        counts.idle++;
        break;
      case EventType.FocusLost:
        counts.away++;
        break;
      default:
        break;
    }
  }

  const slices: EventMixSlice[] = [
    { label: "Writing", count: counts.typing, kind: "typing" },
    { label: "Revising", count: counts.revising, kind: "revising" },
    { label: "Pasting", count: counts.paste, kind: "paste" },
    { label: "Paused", count: counts.idle, kind: "idle" },
    { label: "Left the tab", count: counts.away, kind: "away" },
  ];

  return slices
    .filter((slice) => slice.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Every paste, in time order, for the timeline markers. */
export function pasteMoments(events: ReplayEvent[]) {
  return events
    .filter((event) => event.type === EventType.Paste)
    .map((event) => ({
      sequence: event.sequence,
      offsetMs: event.offsetMs,
      words: event.pastedWords,
    }));
}

export const BAND_COLOURS: Record<BandKind, string> = {
  typing: "var(--color-primary)",
  paste: "var(--color-warning)",
  revising: "var(--color-chart-4)",
  idle: "var(--color-border)",
  away: "var(--color-destructive)",
};

export const BAND_LABELS: Record<BandKind, string> = {
  typing: "Writing",
  paste: "Pasted",
  revising: "Revising",
  idle: "Paused",
  away: "Left the tab",
};

/** Compact duration — "4m 12s", "1h 06m". Zero reads as a dash, not "0s". */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "—";

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** Playback clock — "1:06". */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
