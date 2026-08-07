"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface RubricRow {
  /** Present for a criterion that already exists, so an edit keeps its marks. */
  id?: string;
  title: string;
  description: string;
  maxPoints: number;
}

/**
 * Builds the rubric an assignment is marked against.
 *
 * The total is shown rather than entered: for a rubric-graded assignment the
 * maximum *is* the sum of the criteria, so offering a separate box for it would
 * invite a number that contradicts the rows above it.
 */
export function RubricBuilder({
  rows,
  onChange,
  error,
}: {
  rows: RubricRow[];
  onChange: (rows: RubricRow[]) => void;
  error?: string;
}) {
  const total = rows.reduce((sum, row) => sum + (Number(row.maxPoints) || 0), 0);

  function update(index: number, patch: Partial<RubricRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function add() {
    onChange([...rows, { title: "", description: "", maxPoints: 10 }]);
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;

    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <Label>Rubric</Label>
          <p className="pt-0.5 text-xs text-muted-foreground text-pretty">
            What the work is judged on, and what each part is worth. Students see
            this before they start.
          </p>
        </div>

        <span className="shrink-0 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs tabular">
          Total <span className="font-semibold">{total}</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground text-pretty">
            No criteria yet. Add the first thing this work is judged on.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.id ?? `new-${index}`}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-start gap-2">
                {/* Buttons rather than drag: keyboard-reachable, and a rubric
                    is rarely long enough for dragging to be worth it. */}
                <div className="flex shrink-0 flex-col pt-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    <GripVertical className="size-3.5 rotate-90" aria-hidden />
                  </button>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      aria-label={`Criterion ${index + 1} name`}
                      placeholder="Argument and structure"
                      value={row.title}
                      onChange={(event) => update(index, { title: event.target.value })}
                      className="flex-1"
                    />

                    <div className="flex w-28 shrink-0 items-center gap-1.5">
                      <Input
                        aria-label={`Criterion ${index + 1} marks`}
                        type="number"
                        min={1}
                        max={1000}
                        step="0.5"
                        value={row.maxPoints}
                        onChange={(event) =>
                          update(index, { maxPoints: Number(event.target.value) })
                        }
                        className="tabular"
                      />
                      <span className="text-xs text-muted-foreground">marks</span>
                    </div>
                  </div>

                  <Textarea
                    aria-label={`Criterion ${index + 1} description`}
                    rows={2}
                    placeholder="What earns full marks here? (optional, but this is what makes a rubric useful)"
                    value={row.description}
                    onChange={(event) => update(index, { description: event.target.value })}
                    className="resize-y text-sm leading-relaxed"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove criterion ${index + 1}`}
                  onClick={() => remove(index)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-3.5" aria-hidden />
        Add criterion
      </Button>

      {rows.length > 0 ? (
        <p className={cn("text-xs text-muted-foreground")}>
          This assignment will be marked out of <span className="tabular">{total}</span>.
        </p>
      ) : null}
    </div>
  );
}
