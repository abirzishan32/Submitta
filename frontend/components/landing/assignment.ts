/**
 * The assignment that gets written on the page.
 *
 * Content is authored as an ordered score: every mark — a line of prose, an
 * equation, an underline, a diagram stroke, a correction — occupies a slice of
 * the sequence, and the painter renders the score up to a given position. Scroll
 * supplies the position, so scrubbing backwards un-writes exactly as it wrote.
 *
 * Writing is drawn glyph by glyph with the last glyph clipped mid-stroke, which
 * is what makes it read as a hand moving rather than text fading in. The painter
 * reports where the nib currently is so the pen in the 3D scene can sit on it.
 */

export interface PenState {
  /** Nib position in canvas pixels, or null when nothing is being written. */
  x: number;
  y: number;
  visible: boolean;
  /** Radians. Lets the pen lean into the direction of travel. */
  tilt: number;
}

type Mark =
  | { kind: "text"; at: number; span: number; x: number; y: number; text: string; size: number; weight?: "normal" | "bold"; colour?: string }
  | { kind: "rule"; at: number; span: number; x1: number; y1: number; x2: number; y2: number; width?: number; colour?: string }
  | { kind: "highlight"; at: number; span: number; x: number; y: number; w: number; h: number }
  | { kind: "strike"; at: number; span: number; x: number; y: number; w: number }
  | { kind: "arc"; at: number; span: number; cx: number; cy: number; r: number; from: number; to: number; width?: number; colour?: string }
  | { kind: "curve"; at: number; span: number; points: Array<[number, number]>; width?: number; colour?: string };

/** Page is authored in a 1000×1400 space and scaled to whatever texture size is in use. */
export const PAGE_W = 1000;
export const PAGE_H = 1400;

const INK = "#1c2a4a";
const INK_LIGHT = "#33406b";
const RED = "#a8342a";

/**
 * The score.
 *
 * Timings overlap slightly — a hand does not finish one line and pause before
 * starting the next — and the diagram is drawn while the prose beside it is
 * still going, the way you would sketch a figure then annotate it.
 */
const MARKS: Mark[] = [
  // Header block
  { kind: "text", at: 0.00, span: 0.030, x: 96, y: 150, text: "Abir Rahman", size: 30, colour: INK },
  { kind: "text", at: 0.02, span: 0.028, x: 96, y: 192, text: "Grade 10 — Section A · Physics", size: 24, colour: INK_LIGHT },
  { kind: "text", at: 0.04, span: 0.022, x: 700, y: 150, text: "14 Aug", size: 26, colour: INK_LIGHT },

  // Title + rule under it
  { kind: "text", at: 0.06, span: 0.055, x: 96, y: 276, text: "Projectile Motion", size: 44, weight: "bold", colour: INK },
  { kind: "rule", at: 0.115, span: 0.020, x1: 96, y1: 296, x2: 470, y2: 299, width: 3, colour: INK },

  // Question
  { kind: "text", at: 0.14, span: 0.045, x: 96, y: 366, text: "Q1. A ball is thrown at 20 m/s at 35° to", size: 27, colour: INK },
  { kind: "text", at: 0.18, span: 0.030, x: 96, y: 408, text: "the horizontal. Find its range.", size: 27, colour: INK },

  // Working
  { kind: "text", at: 0.22, span: 0.030, x: 96, y: 486, text: "Resolving the initial velocity:", size: 26, colour: INK_LIGHT },
  { kind: "text", at: 0.25, span: 0.038, x: 130, y: 542, text: "uₓ = u cosθ = 20 cos 35°", size: 28, colour: INK },
  { kind: "text", at: 0.29, span: 0.030, x: 130, y: 590, text: "= 16.4 m/s", size: 28, colour: INK },
  { kind: "text", at: 0.32, span: 0.038, x: 130, y: 646, text: "uᵧ = u sinθ = 20 sin 35°", size: 28, colour: INK },
  { kind: "text", at: 0.36, span: 0.030, x: 130, y: 694, text: "= 11.5 m/s", size: 28, colour: INK },

  // Diagram — axes, trajectory, labels
  { kind: "rule", at: 0.40, span: 0.022, x1: 620, y1: 760, x2: 620, y2: 560, width: 2, colour: INK_LIGHT },
  { kind: "rule", at: 0.42, span: 0.022, x1: 620, y1: 760, x2: 900, y2: 760, width: 2, colour: INK_LIGHT },
  {
    kind: "curve", at: 0.44, span: 0.055, width: 2.5, colour: INK,
    points: [[620, 760], [660, 640], [710, 585], [760, 570], [810, 600], [855, 668], [886, 760]],
  },
  { kind: "curve", at: 0.50, span: 0.018, width: 2, colour: INK, points: [[620, 760], [668, 706]] },
  { kind: "curve", at: 0.51, span: 0.014, width: 2, colour: INK, points: [[668, 706], [652, 712]] },
  { kind: "curve", at: 0.52, span: 0.014, width: 2, colour: INK, points: [[668, 706], [662, 722]] },
  { kind: "text", at: 0.53, span: 0.016, x: 676, y: 690, text: "u", size: 24, colour: INK },
  { kind: "text", at: 0.545, span: 0.016, x: 592, y: 556, text: "y", size: 22, colour: INK_LIGHT },
  { kind: "text", at: 0.56, span: 0.016, x: 906, y: 768, text: "x", size: 22, colour: INK_LIGHT },
  { kind: "arc", at: 0.575, span: 0.020, cx: 620, cy: 760, r: 46, from: -0.62, to: 0, width: 1.8, colour: INK_LIGHT },
  { kind: "text", at: 0.59, span: 0.014, x: 672, y: 748, text: "35°", size: 20, colour: INK_LIGHT },

  // Time of flight
  { kind: "text", at: 0.61, span: 0.032, x: 96, y: 774, text: "Time of flight:", size: 26, colour: INK_LIGHT },
  { kind: "text", at: 0.64, span: 0.040, x: 130, y: 830, text: "T = 2uᵧ / g = 2(11.5) / 9.8", size: 28, colour: INK },

  // A wrong value, struck out and corrected in the margin — the detail that
  // makes it look like work rather than a printed page.
  { kind: "text", at: 0.68, span: 0.026, x: 130, y: 878, text: "= 2.14 s", size: 28, colour: INK },
  { kind: "strike", at: 0.71, span: 0.016, x: 126, y: 869, w: 132 },
  { kind: "text", at: 0.725, span: 0.028, x: 290, y: 874, text: "2.35 s", size: 28, colour: RED },
  { kind: "curve", at: 0.75, span: 0.018, width: 2, colour: RED, points: [[282, 866], [266, 872], [282, 880]] },

  // Range
  { kind: "text", at: 0.77, span: 0.030, x: 96, y: 952, text: "Range:", size: 26, colour: INK_LIGHT },
  { kind: "text", at: 0.80, span: 0.042, x: 130, y: 1008, text: "R = uₓ T = 16.4 × 2.35", size: 28, colour: INK },

  // Highlighted result, boxed and underlined
  { kind: "highlight", at: 0.845, span: 0.025, x: 122, y: 1036, w: 320, h: 46 },
  { kind: "text", at: 0.86, span: 0.040, x: 130, y: 1070, text: "R ≈ 38.5 m", size: 34, weight: "bold", colour: INK },
  { kind: "rule", at: 0.90, span: 0.020, x1: 128, y1: 1086, x2: 348, y2: 1089, width: 2.5, colour: INK },

  // Margin note
  { kind: "text", at: 0.925, span: 0.030, x: 620, y: 1010, text: "check g = 9.8", size: 22, colour: RED },
  { kind: "text", at: 0.95, span: 0.028, x: 620, y: 1046, text: "not 10 !", size: 22, colour: RED },
  { kind: "curve", at: 0.975, span: 0.022, width: 1.8, colour: RED, points: [[606, 1002], [576, 1040], [560, 1064]] },
];

/**
 * Ruled lines and margin, drawn once beneath everything.
 *
 * Printed rather than written, so this is not part of the score — the paper
 * arrives already ruled.
 */
export function paintRuling(ctx: CanvasRenderingContext2D, scale: number) {
  ctx.save();
  ctx.scale(scale, scale);

  // Feint horizontal rules.
  ctx.strokeStyle = "rgba(120, 145, 180, 0.30)";
  ctx.lineWidth = 1;

  for (let y = 150; y < PAGE_H - 90; y += 48) {
    ctx.beginPath();
    ctx.moveTo(80, y + 12);
    ctx.lineTo(PAGE_W - 70, y + 12);
    ctx.stroke();
  }

  // Margin.
  ctx.strokeStyle = "rgba(190, 120, 120, 0.36)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(80, 70);
  ctx.lineTo(80, PAGE_H - 70);
  ctx.stroke();

  ctx.restore();
}

// --- painting ------------------------------------------------------------

/** Deterministic jitter, so a hand-drawn wobble stays put between frames. */
function wobble(seed: number, amount: number): number {
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  return ((n - Math.floor(n)) - 0.5) * amount;
}

function localProgress(mark: Mark, progress: number): number {
  if (progress <= mark.at) return 0;
  if (progress >= mark.at + mark.span) return 1;
  return (progress - mark.at) / mark.span;
}

function paintText(
  ctx: CanvasRenderingContext2D,
  mark: Extract<Mark, { kind: "text" }>,
  t: number,
  font: string,
  pen: PenState,
) {
  ctx.font = `${mark.weight === "bold" ? "700" : "400"} ${mark.size}px ${font}`;
  ctx.fillStyle = mark.colour ?? INK;
  ctx.textBaseline = "alphabetic";

  const chars = [...mark.text];
  const shown = t * chars.length;
  const whole = Math.floor(shown);
  const partial = shown - whole;

  let x = mark.x;

  for (let i = 0; i < Math.min(whole, chars.length); i += 1) {
    const ch = chars[i];
    // Each glyph sits a hair off the baseline and leans slightly — a hand does
    // not place letters on a perfect line.
    const dy = wobble(mark.x + i * 7.3 + mark.y, 1.6);
    const rot = wobble(mark.y + i * 3.1, 0.028);

    ctx.save();
    ctx.translate(x, mark.y + dy);
    ctx.rotate(rot);
    ctx.fillText(ch, 0, 0);
    ctx.restore();

    x += ctx.measureText(ch).width;
  }

  // The glyph under the nib, clipped to however much of it is written.
  if (whole < chars.length && partial > 0) {
    const ch = chars[whole];
    const w = ctx.measureText(ch).width;
    const dy = wobble(mark.x + whole * 7.3 + mark.y, 1.6);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 1, mark.y - mark.size * 1.1, w * partial + 1, mark.size * 1.5);
    ctx.clip();
    ctx.translate(x, mark.y + dy);
    ctx.rotate(wobble(mark.y + whole * 3.1, 0.028));
    ctx.fillText(ch, 0, 0);
    ctx.restore();

    pen.x = x + w * partial;
    pen.y = mark.y;
    pen.visible = true;
    pen.tilt = 0.08;
  } else if (t > 0 && t < 1) {
    pen.x = x;
    pen.y = mark.y;
    pen.visible = true;
  }
}

function paintCurve(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  t: number,
  width: number,
  colour: string,
  pen: PenState,
) {
  if (t <= 0) return;

  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Walk the polyline by arc length so the stroke advances at a steady speed
  // regardless of how the control points are spaced.
  const lengths: number[] = [0];
  let total = 0;

  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    lengths.push(total);
  }

  const target = total * t;

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  let tip: [number, number] = points[0];

  for (let i = 1; i < points.length; i += 1) {
    if (lengths[i] <= target) {
      ctx.lineTo(points[i][0], points[i][1]);
      tip = points[i];
      continue;
    }

    const segment = lengths[i] - lengths[i - 1];
    const f = segment === 0 ? 0 : (target - lengths[i - 1]) / segment;
    const x = points[i - 1][0] + (points[i][0] - points[i - 1][0]) * f;
    const y = points[i - 1][1] + (points[i][1] - points[i - 1][1]) * f;
    ctx.lineTo(x, y);
    tip = [x, y];
    break;
  }

  ctx.stroke();

  if (t < 1) {
    pen.x = tip[0];
    pen.y = tip[1];
    pen.visible = true;
    pen.tilt = -0.1;
  }
}

/**
 * Renders the score up to `progress` onto a page-sized context.
 *
 * @param scale  canvas pixels per authored unit, so the same score fits any
 *               texture resolution.
 * @param font   resolved CSS font family for the handwriting face.
 */
export function paintAssignment(
  ctx: CanvasRenderingContext2D,
  progress: number,
  scale: number,
  font: string,
): PenState {
  const pen: PenState = { x: 0, y: 0, visible: false, tilt: 0 };

  ctx.save();
  ctx.scale(scale, scale);

  for (const mark of MARKS) {
    const t = localProgress(mark, progress);
    if (t <= 0) continue;

    switch (mark.kind) {
      case "text":
        paintText(ctx, mark, t, font, pen);
        break;

      case "rule":
        paintCurve(
          ctx,
          [[mark.x1, mark.y1], [mark.x2, mark.y2]],
          t,
          mark.width ?? 2,
          mark.colour ?? INK,
          pen,
        );
        break;

      case "curve":
        paintCurve(ctx, mark.points, t, mark.width ?? 2, mark.colour ?? INK, pen);
        break;

      case "strike":
        paintCurve(
          ctx,
          [[mark.x, mark.y], [mark.x + mark.w, mark.y - 3]],
          t,
          2.4,
          RED,
          pen,
        );
        break;

      case "arc": {
        ctx.strokeStyle = mark.colour ?? INK_LIGHT;
        ctx.lineWidth = mark.width ?? 2;
        ctx.beginPath();
        ctx.arc(mark.cx, mark.cy, mark.r, mark.from, mark.from + (mark.to - mark.from) * t);
        ctx.stroke();
        break;
      }

      case "highlight": {
        // Laid down in one wet pass, so it grows sideways and sits under the ink.
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "rgba(250, 214, 96, 0.55)";
        ctx.fillRect(mark.x, mark.y, mark.w * t, mark.h);
        ctx.restore();
        break;
      }
    }
  }

  ctx.restore();

  pen.x *= scale;
  pen.y *= scale;

  return pen;
}
