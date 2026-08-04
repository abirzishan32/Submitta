"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { SearchInput, Pagination, FilterBar } from "@/components/common/list-controls";
import { FilterSelect } from "@/components/common/filter-select";
import { SubmissionStatusBadge, LateBadge } from "@/components/common/status-badge";
import { FadeInUp } from "@/components/motion/primitives";
import { apiClient } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatRelative, formatMarks, initialsOf } from "@/lib/format";
import type {
  OfferingOption,
  PagedResult,
  SubmissionStatus,
  SubmissionSummary,
} from "@/lib/api/types";

/**
 * The marking queue across every assignment the teacher owns.
 *
 * Defaults to oldest-submitted first, because the fairest order to mark in is
 * the order work arrived.
 */
export function GradingQueueView({
  initial,
  offerings,
  basePath = "/teacher/grading",
}: {
  initial: PagedResult<SubmissionSummary>;
  offerings: OfferingOption[];
  /** Where a row leads. An administrator reads the same queue from /admin. */
  basePath?: string;
}) {
  const { t, locale } = useTranslation();
  const router = useRouter();

  const [result, setResult] = useState(initial);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const [late, setLate] = useState("");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const data = await apiClient.get<PagedResult<SubmissionSummary>>(
      "/api/v1/grading/submissions",
      {
        page,
        pageSize: 20,
        sortBy: "submittedAt",
        search: search || undefined,
        status: status || undefined,
        classSubjectId: offeringId || undefined,
        isLate: late === "" ? undefined : late === "late",
      },
    );

    setResult(data);
  }, [page, search, status, offeringId, late]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      return;
    }
    startTransition(() => void load());
  }, [load, mounted]);

  const hasFilters = Boolean(search || status || offeringId || late);

  const columns: Column<SubmissionSummary>[] = [
    {
      key: "student",
      header: t.grading.student,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[0.6875rem] font-medium text-accent-foreground">
            {initialsOf(row.studentName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.studentName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.assignmentTitle}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "submittedAt",
      header: t.grading.submittedAt,
      secondary: true,
      cell: (row) => (
        <span className="text-xs text-muted-foreground tabular">
          {formatRelative(row.submittedAt, locale)}
        </span>
      ),
    },
    {
      key: "status",
      header: t.common.status,
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <SubmissionStatusBadge status={row.status} />
          {row.isLate ? <LateBadge /> : null}
        </div>
      ),
    },
    {
      key: "marks",
      header: t.grading.marks,
      className: "text-end",
      cell: (row) => (
        <span className="tabular text-sm">
          {row.status === "Graded" ? formatMarks(row.marks, row.maxMarks, locale) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t.grading.title} description={t.grading.subtitle} />

      <FadeInUp delay={0.04} className="space-y-3">
        <FilterBar
          hasFilters={hasFilters}
          onClear={() => {
            setSearch("");
            setStatus("");
            setOfferingId("");
            setLate("");
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
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            label={t.common.status}
            width="w-44"
            options={(
              [
                "Submitted",
                "UnderReview",
                "Graded",
                "ReturnedForRevision",
              ] as SubmissionStatus[]
            ).map((value) => ({ value, label: t.submissionStatus[value] }))}
          />

          {offerings.length > 1 ? (
            <FilterSelect
              value={offeringId}
              onChange={(value) => {
                setOfferingId(value);
                setPage(1);
              }}
              label={t.assignments.classSubject}
              width="w-56"
              options={offerings.map((offering) => ({
                value: offering.classSubjectId,
                label: offering.label,
              }))}
            />
          ) : null}

          <FilterSelect
            value={late}
            onChange={(value) => {
              setLate(value);
              setPage(1);
            }}
            label={t.grading.late}
            width="w-32"
            options={[
              { value: "late", label: t.grading.late },
              { value: "ontime", label: t.common.no },
            ]}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={result.items}
          getRowKey={(row) => row.id}
          loading={isPending}
          emptyIcon={Inbox}
          emptyTitle={hasFilters ? t.common.noResults : t.grading.empty}
          onRowClick={(row) => router.push(`${basePath}/${row.id}`)}
        />

        <Pagination result={result} onPageChange={setPage} />
      </FadeInUp>
    </div>
  );
}
