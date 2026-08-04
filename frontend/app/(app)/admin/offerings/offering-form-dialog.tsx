"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import type { ClassDto, SubjectDto } from "@/lib/api/types";

/**
 * Offers a subject to a class.
 *
 * Create-only: an offering is just the pair, so "editing" one would mean
 * pointing existing assignments at a different class. Remove and re-add instead.
 */
export function OfferingFormDialog({
  open,
  classes,
  subjects,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  classes: ClassDto[];
  subjects: SubjectDto[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClassId("");
    setSubjectId("");
    setError(null);
  }, [open]);

  async function submit() {
    if (!classId || !subjectId) {
      setError(t.validation.required);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiClient.post("/api/v1/admin/offerings", { classId, subjectId });
      toast.success(t.offerings.created);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t.errors.generic);
    } finally {
      setSaving(false);
    }
  }

  const labelFor = (items: Array<{ id: string; name: string }>, value: unknown) =>
    items.find((item) => item.id === value)?.name ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.offerings.newOffering}</DialogTitle>
          <DialogDescription>{t.offerings.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField id="classId" label={t.offerings.class}>
            <Select value={classId} onValueChange={(v) => setClassId(String(v))}>
              <SelectTrigger id="classId" className="w-full">
                <SelectValue placeholder={t.offerings.class}>
                  {(value: unknown) => labelFor(classes, value)}
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

          <FormField id="subjectId" label={t.offerings.subject}>
            <Select value={subjectId} onValueChange={(v) => setSubjectId(String(v))}>
              <SelectTrigger id="subjectId" className="w-full">
                <SelectValue placeholder={t.offerings.subject}>
                  {(value: unknown) => labelFor(subjects, value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

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
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
