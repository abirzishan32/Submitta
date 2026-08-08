"use client";

import { useCallback, useState } from "react";
import { Layers, Plus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { SearchInput, Pagination, FilterBar } from "@/components/common/list-controls";
import { FilterSelect } from "@/components/common/filter-select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FadeInUp } from "@/components/motion/primitives";
import { OfferingFormDialog } from "./offering-form-dialog";
import { AssignTeacherDialog } from "./assign-teacher-dialog";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useListReload } from "@/lib/api/use-list-reload";
import { useTranslation } from "@/components/providers/i18n-provider";
import type {
  AssignedTeacher,
  ClassDto,
  OfferingDto,
  PagedResult,
  SubjectDto,
  UserDto,
} from "@/lib/api/types";

/**
 * Class-subject offerings.
 *
 * The most consequential admin screen: an offering is what an assignment
 * attaches to, and the teachers listed against it are the ones who may create
 * and grade that work.
 */
export function OfferingsView({
  initial,
  classes,
  subjects,
  teachers,
}: {
  initial: PagedResult<OfferingDto>;
  classes: ClassDto[];
  subjects: SubjectDto[];
  teachers: UserDto[];
}) {
  const { t, n } = useTranslation();

  const [result, setResult] = useState(initial);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [assigningTo, setAssigningTo] = useState<OfferingDto | null>(null);
  const [deleting, setDeleting] = useState<OfferingDto | null>(null);
  const [removingTeacher, setRemovingTeacher] = useState<
    { offering: OfferingDto; teacher: AssignedTeacher } | null
  >(null);

  const load = useCallback(async () => {
    const data = await apiClient.get<PagedResult<OfferingDto>>(
      "/api/v1/admin/offerings",
      {
        page,
        pageSize: 20,
        search: search || undefined,
        classId: classId || undefined,
      },
    );

    setResult(data);
  }, [page, search, classId]);

  const { isPending, reload: refresh } = useListReload(load);
  const hasFilters = Boolean(search || classId);

  function fail(error: unknown) {
    toast.error(error instanceof ClientApiError ? error.message : t.errors.generic);
  }

  const columns: Column<OfferingDto>[] = [
    {
      key: "offering",
      header: `${t.offerings.class} · ${t.offerings.subject}`,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.subjectName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.className}{" "}
            <span className="font-[family-name:var(--font-mono-code)]">
              ({row.classCode})
            </span>
          </p>
        </div>
      ),
    },
    {
      key: "teachers",
      header: t.offerings.teachers,
      cell: (row) =>
        row.teachers.length === 0 ? (
          // Worth flagging: an offering with no teacher can never receive work.
          <span className="text-xs text-warning">{t.offerings.noTeachers}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.teachers.map((teacher) => (
              <span
                key={teacher.teacherAssignmentId}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 py-0.5 ps-2 pe-1 text-xs"
              >
                {teacher.teacherName}
                <button
                  type="button"
                  aria-label={`${t.offerings.removeTeacher}: ${teacher.teacherName}`}
                  onClick={() => setRemovingTeacher({ offering: row, teacher })}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ),
    },
    {
      key: "assignments",
      header: t.assignments.title,
      className: "text-end",
      secondary: true,
      cell: (row) => <span className="tabular text-sm">{n(row.assignmentCount)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.common.actions}</span>,
      className: "w-24 text-end",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t.offerings.assignTeacher}
            title={t.offerings.assignTeacher}
            onClick={() => setAssigningTo(row)}
          >
            <UserPlus className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t.common.delete}
            title={t.common.delete}
            onClick={() => setDeleting(row)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.offerings.title}
        description={t.offerings.subtitle}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            {t.offerings.newOffering}
          </Button>
        }
      />

      <FadeInUp delay={0.04} className="space-y-3">
        <FilterBar
          hasFilters={hasFilters}
          onClear={() => {
            setSearch("");
            setClassId("");
            setPage(1);
          }}
        >
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            className="w-full sm:w-64"
          />
          <FilterSelect
            value={classId}
            onChange={(value) => {
              setClassId(value);
              setPage(1);
            }}
            label={t.offerings.class}
            width="w-48"
            options={classes.map((klass) => ({ value: klass.id, label: klass.name }))}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={result.items}
          getRowKey={(row) => row.id}
          loading={isPending}
          emptyIcon={Layers}
          emptyTitle={hasFilters ? t.common.noResults : t.offerings.empty}
        />

        <Pagination result={result} onPageChange={setPage} />
      </FadeInUp>

      <OfferingFormDialog
        open={creating}
        classes={classes}
        subjects={subjects}
        onOpenChange={setCreating}
        onSaved={refresh}
      />

      <AssignTeacherDialog
        offering={assigningTo}
        teachers={teachers}
        onOpenChange={(open) => !open && setAssigningTo(null)}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t.common.delete}
        description={
          deleting
            ? `${deleting.className} · ${deleting.subjectName}`
            : ""
        }
        confirmLabel={t.common.delete}
        onConfirm={async () => {
          if (!deleting) return;

          try {
            await apiClient.delete(`/api/v1/admin/offerings/${deleting.id}`);
            toast.success(t.offerings.deleted);
            refresh();
          } catch (error) {
            // Refused while assignments exist — their submissions would be stranded.
            fail(error);
          }
        }}
      />

      <ConfirmDialog
        open={removingTeacher !== null}
        onOpenChange={(open) => !open && setRemovingTeacher(null)}
        title={t.offerings.removeTeacher}
        description={
          removingTeacher
            ? `${removingTeacher.teacher.teacherName} — ${removingTeacher.offering.className} · ${removingTeacher.offering.subjectName}`
            : ""
        }
        confirmLabel={t.common.remove}
        onConfirm={async () => {
          if (!removingTeacher) return;

          try {
            await apiClient.delete(
              `/api/v1/admin/offerings/teachers/${removingTeacher.teacher.teacherAssignmentId}`,
            );
            toast.success(t.offerings.teacherRemoved);
            refresh();
          } catch (error) {
            fail(error);
          }
        }}
      />
    </div>
  );
}
