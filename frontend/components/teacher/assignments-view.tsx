"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { SearchInput, Pagination, FilterBar } from "@/components/common/list-controls";
import { FilterSelect } from "@/components/common/filter-select";
import { AssignmentStatusBadge } from "@/components/common/status-badge";
import { FadeInUp } from "@/components/motion/primitives";
import { apiClient } from "@/lib/api/client";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatDateTime, formatRelative, deadlineTone } from "@/lib/format";
import type {
  AssignmentDto,
  AssignmentStatus,
  OfferingOption,
  PagedResult,
} from "@/lib/api/types";

/**
 * Assignment list, shared by the teacher and admin routes.
 *
 * The API already scopes results — a teacher sees only their own offerings, an
 * admin sees everything — so the only difference between the two callers is
 * where links point and whether creating is offered.
 */
export function AssignmentsView({
  initial,
  offerings,
  basePath,
  readOnly = false,
}: {
  initial: PagedResult<AssignmentDto>;
  offerings: OfferingOption[];
  basePath: string;
  readOnly?: boolean;
}) {
  const { t, locale, n } = useTranslation();
  const router = useRouter();

  const [result, setResult] = useState(initial);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const data = await apiClient.get<PagedResult<AssignmentDto>>("/api/v1/assignments", {
      page,
      pageSize: 20,
      sortBy: "deadline",
      search: search || undefined,
      status: status || undefined,
      classSubjectId: offeringId || undefined,
    });

    setResult(data);
  }, [page, search, status, offeringId]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      return;
    }
    startTransition(() => void load());
  }, [load, mounted]);

  const hasFilters = Boolean(search || status || offeringId);

  const columns: Column<AssignmentDto>[] = [
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
      key: "status",
      header: t.common.status,
      cell: (row) => <AssignmentStatusBadge status={row.status} />,
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
                  ? "text-sm text-destructive"
                  : tone === "urgent"
                    ? "text-sm text-warning"
                    : "text-sm"
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
      key: "submissions",
      header: t.assignments.submissions,
      className: "text-end",
      cell: (row) => (
        <div className="space-y-0.5 text-end">
          <p className="text-sm tabular">
            {n(row.submissionCount)} / {n(row.enrolledStudentCount)}
          </p>
          <p className="text-xs text-muted-foreground tabular">
            {n(row.gradedCount)} {t.dashboard.graded.toLowerCase()}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.assignments.title}
        description={t.assignments.subtitle}
        actions={
          readOnly ? undefined : (
            <Button render={<Link href={`${basePath}/assignments/new`} />}>
              <Plus className="size-4" aria-hidden />
              {t.assignments.newAssignment}
            </Button>
          )
        }
      />

      <FadeInUp delay={0.04} className="space-y-3">
        <FilterBar
          hasFilters={hasFilters}
          onClear={() => {
            setSearch("");
            setStatus("");
            setOfferingId("");
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
            width="w-36"
            options={(["Draft", "Published", "Archived"] as AssignmentStatus[]).map(
              (value) => ({
                value,
                label: {
                  Draft: t.assignments.statusDraft,
                  Published: t.assignments.statusPublished,
                  Archived: t.assignments.statusArchived,
                }[value],
              }),
            )}
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
        </FilterBar>

        <DataTable
          columns={columns}
          rows={result.items}
          getRowKey={(row) => row.id}
          loading={isPending}
          emptyIcon={ClipboardList}
          emptyTitle={hasFilters ? t.common.noResults : t.assignments.empty}
          emptyDescription={hasFilters ? undefined : t.assignments.emptyHint}
          onRowClick={(row) => router.push(`${basePath}/assignments/${row.id}`)}
        />

        <Pagination result={result} onPageChange={setPage} />
      </FadeInUp>
    </div>
  );
}
