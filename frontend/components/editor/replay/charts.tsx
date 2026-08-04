"use client";

import { useId, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import {
  BAND_COLOURS,
  BAND_LABELS,
  formatClock,
  formatDuration,
  type ActivityBand,
  type EventMixSlice,
  type ProgressPoint,
  type SpeedBucket,
} from "@/lib/editor/replay-analysis";

/**
 * Charts for the replay analysis.
 *
 * Drawn as plain SVG rather than pulled from a charting library: there are four
 * of them, each wants a different affordance (a shared playhead, paste markers,
 * click-to-seek), and wiring those through a general-purpose API costs more than
 * drawing the shapes. Colours come from the theme tokens, so both themes work
 * without a second palette.
 */

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

export function ChartFrame({
  title,
  hint,
  children,
  className,
  action,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-card p-4", className)}
    >
      <header className="flex items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {hint ? (
            <p className="pt-0.5 text-xs text-muted-foreground text-pretty">{hint}</p>
          ) : null}
        </div>
        {action}
      </header>

      {children}
    </section>
  );
}

export function Legend({ kinds }: { kinds: Array<keyof typeof BAND_COLOURS> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3">
      {kinds.map((kind) => (
        <li key={kind} className="inline-flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ background: BAND_COLOURS[kind] }}
          />
          {BAND_LABELS[kind]}
        </li>
      ))}
    </ul>
  );
}

/** Tooltip anchored to the cursor, shared by the charts that support hovering. */
function Tooltip({
  x,
  label,
  width,
}: {
  x: number;
  label: string;
  width: number;
}) {
  // Flipped near the right edge so the label never runs off the chart.
  const flip = x > width * 0.6;

  return (
    <foreignObject
      x={flip ? x - 132 : x + 6}
      y={4}
      width={128}
      height={64}
      style={{ overflow: "visible", pointerEvents: "none" }}
    >
      <div className="rounded-md border border-border bg-popover px-2 py-1 text-[0.6875rem] leading-snug text-popover-foreground shadow-[var(--shadow-overlay)]">
        {label}
      </div>
    </foreignObject>
  );
}

// ---------------------------------------------------------------------------
// Progress — the centrepiece
// ---------------------------------------------------------------------------

/**
 * Word count over time, stacked by origin.
 *
 * The shape carries the meaning: typing is a slope, a paste is a cliff. A
 * teacher reads "written steadily over an hour" or "arrived in three blocks"
 * from the silhouette alone, without interpreting a percentage.
 */
export function ProgressChart({
  points,
  durationMs,
  playheadMs,
  onSeek,
  height = 200,
}: {
  points: ProgressPoint[];
  durationMs: number;
  playheadMs?: number;
  onSeek?: (ms: number) => void;
  height?: number;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<{ x: number; point: ProgressPoint } | null>(null);

  const width = 800;
  const padding = { top: 8, right: 8, bottom: 20, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxWords = Math.max(1, ...points.map((p) => p.total));
  const span = Math.max(1, durationMs);

  const x = (ms: number) => padding.left + (ms / span) * plotWidth;
  const y = (words: number) => padding.top + plotHeight - (words / maxWords) * plotHeight;

  const { totalPath, typedPath } = useMemo(() => {
    // Step-wise rather than smoothed: the document had exactly this many words
    // until the next event changed it, and a curve would invent intermediate
    // states that never existed.
    const step = (pick: (p: ProgressPoint) => number) => {
      if (points.length === 0) return "";

      let d = `M ${x(points[0].offsetMs)} ${y(pick(points[0]))}`;
      for (let i = 1; i < points.length; i++) {
        d += ` L ${x(points[i].offsetMs)} ${y(pick(points[i - 1]))}`;
        d += ` L ${x(points[i].offsetMs)} ${y(pick(points[i]))}`;
      }
      d += ` L ${x(span)} ${y(pick(points[points.length - 1]))}`;
      return d;
    };

    const close = (d: string) =>
      `${d} L ${x(span)} ${y(0)} L ${x(points[0]?.offsetMs ?? 0)} ${y(0)} Z`;

    return {
      totalPath: close(step((p) => p.total)),
      typedPath: close(step((p) => p.typed)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, span, maxWords, height]);

  function pointAt(clientX: number, rect: DOMRect) {
    const ratio = (clientX - rect.left) / rect.width;
    const ms = Math.max(0, Math.min(span, ratio * span));

    let found = points[0];
    for (const p of points) {
      if (p.offsetMs <= ms) found = p;
      else break;
    }

    return { ms, point: found };
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={cn("w-full", onSeek && "cursor-pointer")}
        role="img"
        aria-label={`Word count over time, reaching ${maxWords} words`}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const { ms, point } = pointAt(event.clientX, rect);
          setHover({ x: x(ms), point });
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(event) => {
          if (!onSeek) return;
          const rect = event.currentTarget.getBoundingClientRect();
          onSeek(pointAt(event.clientX, rect).ms);
        }}
      >
        <defs>
          <linearGradient id={`${gradientId}-typed`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {gridLines.map((ratio) => {
          const value = Math.round(maxWords * (1 - ratio));
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={padding.top + plotHeight * ratio}
                y2={padding.top + plotHeight * ratio}
                stroke="var(--color-border)"
                strokeWidth={1}
                strokeDasharray={ratio === 1 ? undefined : "3 4"}
              />
              <text
                x={padding.left - 6}
                y={padding.top + plotHeight * ratio + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                style={{ fontSize: 9 }}
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* Pasted words are the band between the two lines — the gap itself is
            the quantity, so it needs no separate reading. */}
        <path d={totalPath} fill="var(--color-warning)" fillOpacity={0.28} />
        <path d={typedPath} fill={`url(#${gradientId}-typed)`} />

        <path
          d={totalPath.replace(/ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z$/, "")}
          fill="none"
          stroke="var(--color-warning)"
          strokeWidth={1.5}
        />
        <path
          d={typedPath.replace(/ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z$/, "")}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={1.5}
        />

        {playheadMs !== undefined ? (
          <line
            x1={x(playheadMs)}
            x2={x(playheadMs)}
            y1={padding.top}
            y2={padding.top + plotHeight}
            stroke="var(--color-foreground)"
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        ) : null}

        {hover ? (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={padding.top}
              y2={padding.top + plotHeight}
              stroke="var(--color-foreground)"
              strokeWidth={1}
              strokeDasharray="2 3"
              strokeOpacity={0.4}
            />
            <circle cx={hover.x} cy={y(hover.point.total)} r={3} fill="var(--color-warning)" />
            <circle cx={hover.x} cy={y(hover.point.typed)} r={3} fill="var(--color-primary)" />
            <Tooltip
              x={hover.x}
              width={width}
              label={`${formatClock(hover.point.offsetMs)} · ${hover.point.typed} typed · ${hover.point.pasted} pasted`}
            />
          </>
        ) : null}

        <text
          x={padding.left}
          y={height - 6}
          className="fill-muted-foreground"
          style={{ fontSize: 9 }}
        >
          0:00
        </text>
        <text
          x={width - padding.right}
          y={height - 6}
          textAnchor="end"
          className="fill-muted-foreground"
          style={{ fontSize: 9 }}
        >
          {formatClock(durationMs)}
        </text>
      </svg>

      <Legend kinds={["typing", "paste"]} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------------

/** Typing pace through the session, with pastes marked where they landed. */
export function SpeedChart({
  buckets,
  durationMs,
  playheadMs,
  onSeek,
  height = 140,
}: {
  buckets: SpeedBucket[];
  durationMs: number;
  playheadMs?: number;
  onSeek?: (ms: number) => void;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const width = 800;
  const padding = { top: 8, right: 8, bottom: 18, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const peak = Math.max(1, ...buckets.map((b) => b.wpm));
  const barWidth = plotWidth / Math.max(1, buckets.length);

  if (buckets.length === 0) {
    return <Empty>Not enough activity to chart a pace.</Empty>;
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={cn("w-full", onSeek && "cursor-pointer")}
        role="img"
        aria-label={`Typing speed over time, peaking at ${peak} words per minute`}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={padding.top + plotHeight * ratio}
              y2={padding.top + plotHeight * ratio}
              stroke="var(--color-border)"
              strokeWidth={1}
              strokeDasharray={ratio === 1 ? undefined : "3 4"}
            />
            <text
              x={padding.left - 6}
              y={padding.top + plotHeight * ratio + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: 9 }}
            >
              {Math.round(peak * (1 - ratio))}
            </text>
          </g>
        ))}

        {buckets.map((bucket, index) => {
          const barHeight = (bucket.wpm / peak) * plotHeight;
          const bx = padding.left + index * barWidth;

          return (
            <g
              key={bucket.startMs}
              onMouseEnter={() => setHover(index)}
              onClick={() => onSeek?.(bucket.startMs)}
            >
              {/* Full-height hit area, so thin bars are still reachable. */}
              <rect
                x={bx}
                y={padding.top}
                width={barWidth}
                height={plotHeight}
                fill={hover === index ? "var(--color-accent)" : "transparent"}
                fillOpacity={0.5}
              />

              {bucket.pastedWords > 0 ? (
                <rect
                  x={bx + 0.5}
                  y={padding.top}
                  width={Math.max(1.5, barWidth - 1)}
                  height={plotHeight}
                  fill="var(--color-warning)"
                  fillOpacity={0.22}
                />
              ) : null}

              <rect
                x={bx + 0.5}
                y={padding.top + plotHeight - barHeight}
                width={Math.max(1, barWidth - 1)}
                height={barHeight}
                rx={1}
                fill="var(--color-primary)"
                fillOpacity={bucket.idle ? 0.25 : 0.85}
              />
            </g>
          );
        })}

        {playheadMs !== undefined ? (
          <line
            x1={padding.left + (playheadMs / Math.max(1, durationMs)) * plotWidth}
            x2={padding.left + (playheadMs / Math.max(1, durationMs)) * plotWidth}
            y1={padding.top}
            y2={padding.top + plotHeight}
            stroke="var(--color-foreground)"
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        ) : null}

        {hover !== null ? (
          <Tooltip
            x={padding.left + hover * barWidth}
            width={width}
            label={`${formatClock(buckets[hover].startMs)} · ${buckets[hover].wpm} wpm${
              buckets[hover].pastedWords > 0
                ? ` · ${buckets[hover].pastedWords} pasted`
                : ""
            }`}
          />
        ) : null}
      </svg>

      <p className="pt-2 text-[0.6875rem] text-muted-foreground">
        Bars are words typed per minute. A shaded column marks a bucket where
        text was pasted.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity strip
// ---------------------------------------------------------------------------

/**
 * The session as phases of work.
 *
 * Doubles as the scrubber in the replay view: clicking a band seeks to it, so
 * "what happened around here?" and "take me there" are the same gesture.
 */
export function ActivityStrip({
  bands,
  durationMs,
  playheadMs,
  onSeek,
  height = 28,
  className,
}: {
  bands: ActivityBand[];
  durationMs: number;
  playheadMs?: number;
  onSeek?: (ms: number) => void;
  height?: number;
  className?: string;
}) {
  const [hover, setHover] = useState<ActivityBand | null>(null);
  const span = Math.max(1, durationMs);

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-md border border-border bg-muted/40",
          onSeek && "cursor-pointer",
        )}
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        onClick={(event) => {
          if (!onSeek) return;
          const rect = event.currentTarget.getBoundingClientRect();
          onSeek(((event.clientX - rect.left) / rect.width) * span);
        }}
      >
        {bands.map((band, index) => {
          const left = (band.startMs / span) * 100;
          const width = Math.max(0.35, ((band.endMs - band.startMs) / span) * 100);

          return (
            <div
              key={`${band.startMs}-${index}`}
              onMouseEnter={() => setHover(band)}
              className="absolute inset-y-0"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: BAND_COLOURS[band.kind],
                opacity: band.kind === "idle" ? 0.5 : 0.85,
              }}
            />
          );
        })}

        {playheadMs !== undefined ? (
          <div
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-foreground"
            style={{ left: `${Math.min(100, (playheadMs / span) * 100)}%` }}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between pt-1.5">
        <Legend kinds={["typing", "revising", "paste", "idle", "away"]} />

        <span className="shrink-0 ps-3 text-[0.6875rem] text-muted-foreground tabular">
          {hover
            ? `${BAND_LABELS[hover.kind]} · ${formatDuration(hover.endMs - hover.startMs)}`
            : formatDuration(durationMs)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/** Typed against pasted, as one bar. Two numbers do not need a pie. */
export function CompositionBar({
  typed,
  pasted,
}: {
  typed: number;
  pasted: number;
}) {
  const total = Math.max(1, typed + pasted);
  const typedShare = (typed / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-8 w-full overflow-hidden rounded-md border border-border">
        <div
          className="flex items-center justify-center bg-primary/80 text-[0.6875rem] font-medium text-primary-foreground"
          style={{ width: `${typedShare}%` }}
        >
          {typedShare >= 14 ? `${Math.round(typedShare)}%` : null}
        </div>
        <div
          className="flex items-center justify-center bg-warning/40 text-[0.6875rem] font-medium"
          style={{ width: `${100 - typedShare}%` }}
        >
          {100 - typedShare >= 14 ? `${Math.round(100 - typedShare)}%` : null}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px] bg-primary" />
          <span className="font-medium tabular">{typed.toLocaleString()}</span>
          <span className="text-muted-foreground">typed</span>
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">pasted</span>
          <span className="font-medium tabular">{pasted.toLocaleString()}</span>
          <span aria-hidden className="size-2 rounded-[2px] bg-warning" />
        </span>
      </div>
    </div>
  );
}

/** Where the student's actions went. A ranked bar list, not a pie. */
export function EventMixChart({ slices }: { slices: EventMixSlice[] }) {
  const total = Math.max(1, slices.reduce((sum, slice) => sum + slice.count, 0));

  if (slices.length === 0) return <Empty>No actions recorded.</Empty>;

  return (
    <ul className="space-y-2">
      {slices.map((slice) => (
        <li key={slice.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span>{slice.label}</span>
            <span className="tabular text-muted-foreground">
              {slice.count} · {Math.round((slice.count / total) * 100)}%
            </span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(slice.count / total) * 100}%`,
                background: BAND_COLOURS[slice.kind],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground text-pretty">{children}</p>
  );
}
