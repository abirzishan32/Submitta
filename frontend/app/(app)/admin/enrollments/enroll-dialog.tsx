"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/common/form-field";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import { initialsOf } from "@/lib/format";
import type { ClassDto, UserDto } from "@/lib/api/types";

/**
 * Enrols one or more students into a class.
 *
 * Multi-select by default rather than a separate "bulk" mode: enrolling a whole
 * class is the normal case, and one student is just a selection of one. The API
 * skips anyone already enrolled, so re-running after adding a name is safe.
 */
export function EnrollDialog({
  open,
  classes,
  students,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  classes: ClassDto[];
  students: UserDto[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t, n } = useTranslation();

  const [classId, setClassId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClassId("");
    setSelected(new Set());
    setFilter("");
    setError(null);
  }, [open]);

  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return students;

    return students.filter(
      (student) =>
        student.fullName.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term),
    );
  }, [students, filter]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!classId || selected.size === 0) {
      setError(t.validation.required);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await apiClient.post<unknown[]>("/api/v1/admin/enrollments/bulk", {
        classId,
        studentIds: [...selected],
      });

      toast.success(
        created.length === 0 ? t.common.noResults : t.enrollments.created,
      );
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t.errors.generic);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.enrollments.newEnrollment}</DialogTitle>
          <DialogDescription>{t.enrollments.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField id="classId" label={t.enrollments.class}>
            <Select value={classId} onValueChange={(v) => setClassId(String(v))}>
              <SelectTrigger id="classId" className="w-full">
                <SelectValue placeholder={t.enrollments.class}>
                  {(value: unknown) =>
                    classes.find((klass) => klass.id === value)?.name ?? ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {classes.map((klass) => (
                  <SelectItem key={klass.id} value={klass.id}>
                    {klass.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t.enrollments.selectStudents}</p>
              {selected.size > 0 ? (
                <span className="text-xs text-muted-foreground tabular">
                  {n(selected.size)} {t.common.of} {n(students.length)}
                </span>
              ) : null}
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-3.5 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t.common.search}
                aria-label={t.common.search}
                className="h-8 ps-8"
              />
            </div>

            <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {visible.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {t.common.noResults}
                </p>
              ) : (
                visible.map((student) => {
                  const isSelected = selected.has(student.id);

                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggle(student.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        isSelected ? "bg-accent" : "hover:bg-accent/50",
                      )}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-medium">
                        {initialsOf(student.fullName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{student.fullName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {student.email}
                        </span>
                      </span>
                      {isSelected ? (
                        <Check className="size-3.5 shrink-0 text-primary" aria-hidden />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button onClick={submit} disabled={saving || selected.size === 0}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t.enrollments.newEnrollment}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
