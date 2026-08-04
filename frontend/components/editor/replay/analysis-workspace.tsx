"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ChevronsRight,
  ClipboardPaste,
  Eye,
  FileText,
  Gauge,
  LineChart,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  SquarePen,
  Timer,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/common/status-badge";
import { reconstruct } from "@/lib/editor/reconstruct";
import {
  activityBands,
  eventMix,
  formatClock,
  formatDuration,
  normaliseEvents,
  pasteMoments,
  progressSeries,
  speedSeries,
} from "@/lib/editor/replay-analysis";
import { EventType, EVENT_LABELS, type ReplayDto } from "@/lib/api/editor-types";
import type { SubmissionDetail } from "@/lib/api/types";
import { MarkingPanel } from "./marking-panel";
import {
  ActivityStrip,
  ChartFrame,
  CompositionBar,
  EventMixChart,
  ProgressChart,
  SpeedChart,
} from "./charts";

const SPEEDS = [1, 2, 4, 8, 16, 32] as const;

type View = "replay" | "analytics";

/**
 * Full-screen workspace for reading how a submission was written.
 *
 * Takes over the viewport deliberately. Marking is a reading task, and the
 * replay only pays for itself when the document is large enough to watch — a
 * panel squeezed beside a form is not that. Grading stays one click away in a
 * drawer, so a teacher can mark without leaving what they just watched.
 */
export function AnalysisWorkspace({
  replay,
  submission,
  onClose,
}: {
  replay: ReplayDto;
  submission: SubmissionDetail;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>("replay");
  const [marking, setMarking] = useState(false);

  // Normalised once, at the boundary: everything downstream compares against
  // names, so however the API serialised the enum cannot reach the charts.
  const events = useMemo(() => normaliseEvents(replay.events), [replay.events]);
  const durationMs = Math.max(1, replay.totalDurationMs);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(4);

  const frame = useRef<number | null>(null);
  const lastTick = useRef(0);
  /** Playback position in document-time milliseconds. */
  const clock = useRef(0);

  const series = useMemo(() => progressSeries(events), [events]);
  const speeds = useMemo(() => speedSeries(events), [events]);
  const bands = useMemo(() => activityBands(events), [events]);
  const mix = useMemo(() => eventMix(events), [events]);
  const pastes = useMemo(() => pasteMoments(events), [events]);

  const { text, pastedRanges } = useMemo(
    () => reconstruct(events.slice(0, index)),
    [events, index],
  );

  const current = events[Math.max(0, index - 1)];
  const playheadMs = current?.offsetMs ?? 0;

  // --- Playback ----------------------------------------------------------

  useEffect(() => {
    if (!playing) {
      if (frame.current) cancelAnimationFrame(frame.current);
      return;
    }

    lastTick.current = performance.now();

    const tick = (now: number) => {
      clock.current += (now - lastTick.current) * speed;
      lastTick.current = now;

      let next = index;
      while (next < events.length && events[next].offsetMs <= clock.current) next++;

      if (next !== index) setIndex(next);

      if (next >= events.length) {
        setPlaying(false);
        return;
      }

      // A pause longer than two seconds of document time is skipped: watching a
      // replay sit still teaches nothing, and the pause is reported anyway.
      const gap = events[next].offsetMs - clock.current;
      if (gap > 2_000 * speed) clock.current = events[next].offsetMs - 400;

      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [playing, speed, index, events]);

  const seekToIndex = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(events.length, target));
      setIndex(clamped);
      clock.current = clamped === 0 ? 0 : (events[clamped - 1]?.offsetMs ?? 0);
    },
    [events],
  );

  /** Seeks by time, which is what the charts and the strip speak in. */
  const seekToTime = useCallback(
    (ms: number) => {
      let target = 0;
      while (target < events.length && events[target].offsetMs <= ms) target++;
      setIndex(target);
      clock.current = ms;
    },
    [events],
  );

  const restart = useCallback(() => {
    seekToIndex(0);
    setPlaying(true);
  }, [seekToIndex]);

  const togglePlay = useCallback(() => {
    if (index >= events.length) restart();
    else setPlaying((v) => !v);
  }, [index, events.length, restart]);

  // --- Keyboard ----------------------------------------------------------

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Never steal keys from the marking form.
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.key === "Escape") {
        if (marking) setMarking(false);
        else onClose();
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.key === "ArrowRight") seekToIndex(index + (event.shiftKey ? 50 : 5));
      if (event.key === "ArrowLeft") seekToIndex(index - (event.shiftKey ? 50 : 5));
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [marking, onClose, togglePlay, seekToIndex, index]);

  const analytics = replay.analytics;
  const pasteHeavy = analytics.pastePercentage >= 40;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight">
              {replay.studentName}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {replay.assignmentTitle}
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
          <ViewTab active={view === "replay"} onClick={() => setView("replay")}>
            <Play className="size-3.5" aria-hidden />
            Replay
          </ViewTab>
          <ViewTab active={view === "analytics"} onClick={() => setView("analytics")}>
            <LineChart className="size-3.5" aria-hidden />
            Analytics
          </ViewTab>
        </div>

        <div className="ms-auto flex items-center gap-2">
          {pasteHeavy ? (
            <StatusPill tone="warning">
              <ClipboardPaste className="size-3" aria-hidden />
              {analytics.pastePercentage}% pasted
            </StatusPill>
          ) : null}

          <Button
            variant={marking ? "default" : "outline"}
            size="sm"
            onClick={() => setMarking((v) => !v)}
          >
            <SquarePen className="size-3.5" aria-hidden />
            {marking ? "Hide marking" : "Mark"}
          </Button>

          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {view === "replay" ? (
            <ReplayView
              text={text}
              pastedRanges={pastedRanges}
              playing={playing}
              index={index}
              events={events}
              bands={bands}
              durationMs={durationMs}
              playheadMs={playheadMs}
              speed={speed}
              current={current}
              finalText={submission.content}
              onSeekTime={seekToTime}
              onSeekIndex={seekToIndex}
              onTogglePlay={togglePlay}
              onRestart={restart}
              onSpeed={setSpeed}
            />
          ) : (
            <AnalyticsView
              replay={replay}
              series={series}
              speeds={speeds}
              bands={bands}
              mix={mix}
              pastes={pastes}
              durationMs={durationMs}
              onSeek={(ms) => {
                seekToTime(ms);
                setView("replay");
              }}
            />
          )}
        </div>

        {/* Marking drawer. Hidden until asked for, so the default state is
            reading rather than form-filling. */}
        {marking ? (
          <aside className="w-full max-w-sm shrink-0 overflow-y-auto border-s border-border bg-muted/20 p-4">
            <h3 className="pb-3 text-sm font-semibold tracking-tight">Marking</h3>
            <MarkingPanel submission={submission} onGraded={onClose} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

function ReplayView({
  text,
  pastedRanges,
  playing,
  index,
  events,
  bands,
  durationMs,
  playheadMs,
  speed,
  current,
  finalText,
  onSeekTime,
  onSeekIndex,
  onTogglePlay,
  onRestart,
  onSpeed,
}: {
  text: string;
  pastedRanges: Array<[number, number]>;
  playing: boolean;
  index: number;
  events: ReplayDto["events"];
  bands: ReturnType<typeof activityBands>;
  durationMs: number;
  playheadMs: number;
  speed: number;
  current: ReplayDto["events"][number] | undefined;
  finalText: string;
  onSeekTime: (ms: number) => void;
  onSeekIndex: (index: number) => void;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSpeed: (speed: (typeof SPEEDS)[number]) => void;
}) {
  const [showFinal, setShowFinal] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Follow the writing as it grows, the way an editor scrolls to the caret.
  useEffect(() => {
    if (playing && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [text, playing]);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto" ref={scroller}>
        <div className="mx-auto w-full max-w-[760px] px-6 py-8">
          {showFinal ? (
            <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">
              {finalText}
            </p>
          ) : index === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
              <PenLine className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Nothing written yet</p>
              <p className="max-w-sm text-sm text-muted-foreground text-pretty">
                Press play, or click anywhere on the timeline below, to watch
                this submission being written.
              </p>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">
              {renderWithPastes(text, pastedRanges)}
              {playing ? (
                <span
                  aria-hidden
                  className="ms-px inline-block h-[1.1em] w-[2px] animate-pulse bg-primary align-text-bottom"
                />
              ) : null}
            </p>
          )}
        </div>
      </div>

      {/* Transport */}
      <div className="shrink-0 space-y-2.5 border-t border-border bg-card/60 px-4 py-3">
        <ActivityStrip
          bands={bands}
          durationMs={durationMs}
          playheadMs={playheadMs}
          onSeek={onSeekTime}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon-sm" variant="outline" aria-label="Restart" onClick={onRestart}>
            <RotateCcw className="size-3.5" aria-hidden />
          </Button>

          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Back"
            onClick={() => onSeekIndex(index - 25)}
          >
            <SkipBack className="size-3.5" aria-hidden />
          </Button>

          <Button size="icon-sm" aria-label={playing ? "Pause" : "Play"} onClick={onTogglePlay}>
            {playing ? (
              <Pause className="size-3.5" aria-hidden />
            ) : (
              <Play className="size-3.5" aria-hidden />
            )}
          </Button>

          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Forward"
            onClick={() => onSeekIndex(index + 25)}
          >
            <SkipForward className="size-3.5" aria-hidden />
          </Button>

          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Skip to end"
            onClick={() => onSeekIndex(events.length)}
          >
            <ChevronsRight className="size-3.5" aria-hidden />
          </Button>

          <div className="ms-1 inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onSpeed(value)}
                aria-pressed={speed === value}
                className={cn(
                  "rounded-[6px] px-1.5 py-0.5 text-[0.6875rem] font-medium tabular transition-colors",
                  speed === value
                    ? "bg-background text-foreground shadow-[var(--shadow-subtle)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}×
              </button>
            ))}
          </div>

          {current ? (
            <StatusPill tone={toneFor(current)}>
              {EVENT_LABELS[current.type] ?? "Edit"}
              {current.type === EventType.Paste ? ` · ${current.pastedWords} words` : ""}
            </StatusPill>
          ) : null}

          <div className="ms-auto flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFinal((v) => !v)}
              className="text-muted-foreground"
            >
              <Eye className="size-3.5" aria-hidden />
              {showFinal ? "Show replay" : "Show final"}
            </Button>

            <span className="text-xs text-muted-foreground tabular">
              {formatClock(playheadMs)} / {formatClock(durationMs)} · {index}/{events.length}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

function AnalyticsView({
  replay,
  series,
  speeds,
  bands,
  mix,
  pastes,
  durationMs,
  onSeek,
}: {
  replay: ReplayDto;
  series: ReturnType<typeof progressSeries>;
  speeds: ReturnType<typeof speedSeries>;
  bands: ReturnType<typeof activityBands>;
  mix: ReturnType<typeof eventMix>;
  pastes: ReturnType<typeof pasteMoments>;
  durationMs: number;
  onSeek: (ms: number) => void;
}) {
  const a = replay.analytics;
  const pasteHeavy = a.pastePercentage >= 40;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4 pb-10">
        {/* Headline numbers */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            icon={Timer}
            label="Time writing"
            value={formatDuration(a.activeWritingMs)}
            hint={`${formatDuration(a.idleMs)} paused`}
          />
          <Metric
            icon={Gauge}
            label="Typing speed"
            value={String(a.typingSpeedWpm)}
            hint="words per minute"
          />
          <Metric
            icon={PenLine}
            label="Words typed"
            value={a.wordsTyped.toLocaleString()}
            hint={`${a.charactersTyped.toLocaleString()} characters`}
          />
          <Metric
            icon={ClipboardPaste}
            label="Words pasted"
            value={a.wordsPasted.toLocaleString()}
            hint={`${a.pastePercentage}% of the total`}
            tone={pasteHeavy ? "warning" : undefined}
          />
        </div>

        {pasteHeavy ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3.5">
            <ClipboardPaste className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-warning-foreground dark:text-warning">
                {a.pastePercentage}% of this submission arrived by paste
              </p>
              <p className="text-xs text-muted-foreground text-pretty">
                Worth a look, not a conclusion — a student may have drafted
                elsewhere, quoted a source, or used an assistive tool. The chart
                below shows exactly when each block arrived; click it to jump to
                that moment in the replay.
              </p>
            </div>
          </div>
        ) : null}

        {/* The centrepiece */}
        <ChartFrame
          title="How the document grew"
          hint="Typing climbs gradually; a paste is a vertical step. Click anywhere to replay from that moment."
        >
          <ProgressChart
            points={series}
            durationMs={durationMs}
            onSeek={onSeek}
            height={220}
          />
        </ChartFrame>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartFrame
            title="Pace over the session"
            hint="Where the writing sped up, slowed down, or stopped."
          >
            <SpeedChart buckets={speeds} durationMs={durationMs} onSeek={onSeek} />
          </ChartFrame>

          <ChartFrame
            title="Session shape"
            hint="What was happening, and when. Click a band to jump there."
          >
            <ActivityStrip
              bands={bands}
              durationMs={durationMs}
              onSeek={onSeek}
              height={40}
            />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 pt-4">
              <Row label="Total elapsed" value={formatDuration(a.totalDurationMs)} />
              <Row label="Writing sessions" value={String(a.sessionCount)} />
              <Row label="Longest pause" value={formatDuration(a.longestPauseMs)} />
              <Row label="Average pause" value={formatDuration(a.averagePauseMs)} />
              <Row label="Left the tab" value={`${a.focusLostCount}×`} />
              <Row label="Deletions" value={String(a.deleteCount)} />
            </dl>
          </ChartFrame>

          <ChartFrame
            title="Where the words came from"
            hint="Typed against pasted, by word count."
          >
            <CompositionBar typed={a.wordsTyped} pasted={a.wordsPasted} />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 pt-4">
              <Row label="Undo / redo" value={`${a.undoCount} / ${a.redoCount}`} />
              <Row label="Characters deleted" value={a.charactersDeleted.toLocaleString()} />
              <Row label="Paste events" value={String(a.pasteCount)} />
              <Row label="Largest paste" value={`${a.largestPasteWords} words`} />
              <Row label="Images / tables" value={`${a.imagesInserted} / ${a.tablesInserted}`} />
              <Row label="Code blocks" value={String(a.codeBlocksInserted)} />
            </dl>
          </ChartFrame>

          <ChartFrame
            title="What the time went on"
            hint="Recorded actions, grouped by kind."
          >
            <EventMixChart slices={mix} />
          </ChartFrame>
        </div>

        {/* Pastes */}
        {a.largePastes.length > 0 ? (
          <ChartFrame
            title="Large pastes"
            hint={`${a.largePastes.length} block${a.largePastes.length === 1 ? "" : "s"} of 40 words or more. Select one to see it arrive.`}
          >
            <ul className="divide-y divide-border">
              {a.largePastes.map((paste) => (
                <li key={paste.sequence}>
                  <button
                    type="button"
                    onClick={() => onSeek(paste.offsetMs)}
                    className="flex w-full items-start gap-3 rounded-md p-2.5 text-start transition-colors hover:bg-accent/60"
                  >
                    <StatusPill tone="warning" className="mt-0.5 shrink-0">
                      {paste.words} words
                    </StatusPill>

                    <span className="min-w-0 flex-1">
                      {paste.preview ? (
                        <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          “{paste.preview}…”
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No preview captured.
                        </span>
                      )}
                    </span>

                    <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular">
                      at {formatDuration(paste.offsetMs)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ChartFrame>
        ) : pastes.length === 0 ? (
          <ChartFrame title="Pastes" hint="Nothing was pasted into this submission.">
            <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <FileText className="size-4" aria-hidden />
              Every word was typed in the editor.
            </p>
          </ChartFrame>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-[var(--shadow-subtle)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p
        className={cn(
          "pt-1.5 text-2xl font-semibold tabular leading-none",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      {hint ? <p className="pt-1 text-[0.6875rem] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xs font-medium tabular">{value}</dd>
    </div>
  );
}

/** Highlights pasted spans so they are never mistaken for typing. */
function renderWithPastes(text: string, ranges: Array<[number, number]>) {
  if (ranges.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(text.slice(cursor, start));

    parts.push(
      <mark
        key={`${start}-${end}`}
        title="Pasted content"
        className="rounded-sm bg-warning/25 text-inherit decoration-warning/60"
      >
        {text.slice(start, end)}
      </mark>,
    );

    cursor = Math.max(cursor, end);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function toneFor(event: ReplayDto["events"][number]) {
  if (event.type === EventType.Paste) return "warning" as const;
  if (event.type === EventType.Delete || event.type === EventType.Cut) return "danger" as const;
  if (event.type === EventType.Idle || event.type === EventType.FocusLost) {
    return "neutral" as const;
  }
  return "info" as const;
}
