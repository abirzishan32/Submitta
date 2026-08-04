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
import { EmptyState } from "@/components/common/empty-state";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import type { OfferingDto, UserDto } from "@/lib/api/types";

/**
 * Grants a teacher access to an offering.
 *
 * Teachers already assigned are filtered out of the list — the API rejects a
 * duplicate, and offering a choice that is guaranteed to fail is a poor way to
 * communicate that.
 */
export function AssignTeacherDialog({
  offering,
  teachers,
  onOpenChange,
  onSaved,
}: {
  offering: OfferingDto | null;
  teachers: UserDto[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();

  const [teacherId, setTeacherId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!offering) return;
    setTeacherId("");
    setError(null);
  }, [offering]);

  const assigned = new Set(offering?.teachers.map((teacher) => teacher.teacherId) ?? []);
  const available = teachers.filter((teacher) => !assigned.has(teacher.id));

  async function submit() {
    if (!offering || !teacherId) {
      setError(t.validation.required);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiClient.post("/api/v1/admin/offerings/teachers", {
        teacherId,
        classSubjectId: offering.id,
      });
      toast.success(t.offerings.teacherAssigned);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : t.errors.generic);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={offering !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.offerings.assignTeacher}</DialogTitle>
          <DialogDescription>
            {offering ? `${offering.className} · ${offering.subjectName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <EmptyState title={t.common.noResults} description={t.offerings.teachers} />
        ) : (
          <div className="space-y-4">
            <FormField id="teacherId" label={t.offerings.teachers}>
              <Select value={teacherId} onValueChange={(v) => setTeacherId(String(v))}>
                <SelectTrigger id="teacherId" className="w-full">
                  <SelectValue placeholder={t.offerings.assignTeacher}>
                    {(value: unknown) =>
                      available.find((teacher) => teacher.id === value)?.fullName ?? ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {available.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.fullName}
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
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button onClick={submit} disabled={saving || available.length === 0}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t.offerings.assignTeacher}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
