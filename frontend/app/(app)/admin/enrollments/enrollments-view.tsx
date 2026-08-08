"use client";

import { useCallback, useState } from "react";
import { Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { SearchInput, Pagination, FilterBar } from "@/components/common/list-controls";
import { FilterSelect } from "@/components/common/filter-select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FadeInUp } from "@/components/motion/primitives";
import { EnrollDialog } from "./enroll-dialog";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useListReload } from "@/lib/api/use-list-reload";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatDate, initialsOf } from "@/lib/format";
import type { ClassDto, EnrollmentDto, PagedResult, UserDto } from "@/lib/api/types";

export function EnrollmentsView({
  initial,
  classes,
  students,
}: {
  initial: PagedResult<EnrollmentDto>;
  classes: ClassDto[];
  students: UserDto[];
}) {
  const { t, locale } = useTranslation();

  const [result, setResult] = useState(initial);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);
  const [enrolling, setEnrolling] = useState(false);
  const [removing, setRemoving] = useState<EnrollmentDto | null>(null);

  const load = useCallback(async () => {
    const data = await apiClient.get<PagedResult<EnrollmentDto>>(
      "/api/v1/admin/enrollments",
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

  const columns: Column<EnrollmentDto>[] = [
    {
      key: "student",
      header: t.enrollments.student,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[0.6875rem] font-medium text-accent-foreground">
            {initialsOf(row.studentName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.studentName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.studentEmail}</p>
          </div>
        </div>
      ),
    },
    {
      key: "class",
      header: t.enrollments.class,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{row.className}</p>
          <p className="truncate font-[family-name:var(--font-mono-code)] text-xs text-muted-foreground">
            {row.classCode}
          </p>
        </div>
      ),
    },
    {
      key: "enrolledAt",
      header: t.enrollments.enrolledAt,
      secondary: true,
      cell: (row) => (
        <span className="text-xs text-muted-foreground tabular">
          {formatDate(row.enrolledAt, locale)}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.common.actions}</span>,
      className: "w-10 text-end",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t.common.remove}
          title={t.common.remove}
          onClick={() => setRemoving(row)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.enrollments.title}
        description={t.enrollments.subtitle}
        actions={
          <Button onClick={() => setEnrolling(true)}>
            <UserPlus className="size-4" aria-hidden />
            {t.enrollments.newEnrollment}
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
            label={t.enrollments.class}
            width="w-48"
            options={classes.map((klass) => ({ value: klass.id, label: klass.name }))}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={result.items}
          getRowKey={(row) => row.id}
          loading={isPending}
          emptyIcon={Users}
          emptyTitle={hasFilters ? t.common.noResults : t.enrollments.empty}
        />

        <Pagination result={result} onPageChange={setPage} />
      </FadeInUp>

      <EnrollDialog
        open={enrolling}
        classes={classes}
        students={students}
        onOpenChange={setEnrolling}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t.common.remove}
        description={
          removing ? `${removing.studentName} — ${removing.className}` : ""
        }
        confirmLabel={t.common.remove}
        onConfirm={async () => {
          if (!removing) return;

          try {
            await apiClient.delete(`/api/v1/admin/enrollments/${removing.id}`);
            toast.success(t.enrollments.deleted);
            refresh();
          } catch (error) {
            // Refused once the student has submitted work for the class —
            // removing it would hide their own marks from them.
            toast.error(
              error instanceof ClientApiError ? error.message : t.errors.generic,
            );
          }
        }}
      />
    </div>
  );
}
