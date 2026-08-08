"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { SearchInput, Pagination, FilterBar } from "@/components/common/list-controls";
import { FilterSelect } from "@/components/common/filter-select";
import { SubmissionStatusBadge, StatusPill, LateBadge } from "@/components/common/status-badge";
import { FadeInUp } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { useListReload } from "@/lib/api/use-list-reload";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatDateTime, formatMarks, formatRelative, deadlineTone } from "@/lib/format";
import type {
  ClassOption,
  PagedResult,
  StudentAssignment,
  SubjectOption,
} from "@/lib/api/types";

type Tab = "all" | "pending" | "submitted";

export function StudentAssignmentsView({
  initial,
  classes,
  subjects,
}: {
  initial: PagedResult<StudentAssignment>;
  classes: ClassOption[];
  subjects: SubjectOption[];
}) {
  const { t, locale, n } = useTranslation();
  const router = useRouter();

  const [result, setResult] = useState(initial);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const data = await apiClient.get<PagedResult<StudentAssignment>>(
      "/api/v1/student/assignments",
      {
        page,
        pageSize: 20,
        sortBy: "deadline",
        search: search || undefined,
        classId: classId || undefined,
        subjectId: subjectId || undefined,
        submitted: tab === "all" ? undefined : tab === "submitted",
      },
    );

    setResult(data);
  }, [page, search, classId, subjectId, tab]);

  const { isPending } = useListReload(load);

  const hasFilters = Boolean(search || classId || subjectId || tab !== "all");

  function clearFilters() {
    setSearch("");
    setClassId("");
    setSubjectId("");
    setTab("all");
    setPage(1);
  }

  const columns: Column<StudentAssignment>[] = [
    {
      key: "title",
      header: t.assignments.assignmentTitle,
      cell: (row) => (
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-medium">{row.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.classCode} · {row.subjectName}
          </p>
        </div>
      ),
    },
    {
      key: "deadline",
      header: t.assignments.deadline,
      secondary: true,
      cell: (row) => {
        const tone = deadlineTone(row.deadline);
        return (
          <div className="space-y-0.5">
            <p
              className={
                tone === "overdue"
                  ? "text-destructive"
                  : tone === "urgent"
                    ? "text-warning"
                    : undefined
              }
            >
              {formatRelative(row.deadline, locale)}
            </p>
            <p className="text-xs text-muted-foreground tabular">
              {formatDateTime(row.deadline, locale)}
            </p>
          </div>
        );
      },
    },
    {
      key: "status",
      header: t.common.status,
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.submissionStatus ? (
            <SubmissionStatusBadge status={row.submissionStatus} />
          ) : (
            <StatusPill tone={row.isPastDeadline ? "danger" : "neutral"}>
              {row.isPastDeadline ? t.dashboard.overdue : t.student.filterPending}
            </StatusPill>
          )}
          {row.isLate ? <LateBadge /> : null}
        </div>
      ),
    },
    {
      key: "marks",
      header: t.grading.marks,
      secondary: true,
      className: "text-end",
      cell: (row) => (
        <span className="tabular text-sm">
          {row.submissionStatus === "Graded"
            ? formatMarks(row.marks, row.maxMarks, locale)
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.student.myAssignments}
        description={t.student.myAssignmentsSubtitle}
      />

      <FadeInUp delay={0.04} className="space-y-3">
        <FilterBar hasFilters={hasFilters} onClear={clearFilters}>
          {/* Tabs as segmented buttons rather than a Select: three mutually
              exclusive views that a student switches between constantly. */}
          <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
            {(["all", "pending", "submitted"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTab(value);
                  setPage(1);
                }}
                aria-pressed={tab === value}
                className={`rounded-[7px] px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                  tab === value
                    ? "bg-background text-foreground shadow-[var(--shadow-subtle)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "all"
                  ? t.student.filterAll
                  : value === "pending"
                    ? t.student.filterPending
                    : t.student.filterSubmitted}
              </button>
            ))}
          </div>

          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            className="w-full sm:w-56"
          />

          {/* Only offered when there is something to choose between. */}
          {classes.length > 1 ? (
            <FilterSelect
              value={classId}
              onChange={(value) => {
                setClassId(value);
                setPage(1);
              }}
              label={t.classes.title}
              width="w-40"
              options={classes.map((option) => ({
                value: option.classId,
                label: option.classCode,
              }))}
            />
          ) : null}

          {subjects.length > 1 ? (
            <FilterSelect
              value={subjectId}
              onChange={(value) => {
                setSubjectId(value);
                setPage(1);
              }}
              label={t.subjects.title}
              options={subjects.map((option) => ({
                value: option.subjectId,
                label: option.subjectName,
              }))}
            />
          ) : null}
        </FilterBar>

        <DataTable
          columns={columns}
          rows={result.items}
          getRowKey={(row) => row.id}
          loading={isPending}
          emptyIcon={FileText}
          emptyTitle={hasFilters ? t.common.noResults : t.student.empty}
          emptyDescription={hasFilters ? undefined : t.student.emptyHint}
          emptyAction={
            hasFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t.common.clearAll}
              </Button>
            ) : undefined
          }
          onRowClick={(row) => router.push(`/student/assignments/${row.id}`)}
        />

        <Pagination result={result} onPageChange={setPage} />
      </FadeInUp>
    </div>
  );
}
