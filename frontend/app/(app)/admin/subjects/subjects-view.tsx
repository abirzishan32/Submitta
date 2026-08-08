"use client";

import { useCallback, useState } from "react";
import { BookOpen, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { SearchInput, Pagination, FilterBar } from "@/components/common/list-controls";
import { FilterSelect } from "@/components/common/filter-select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { StatusPill } from "@/components/common/status-badge";
import { FadeInUp } from "@/components/motion/primitives";
import { SubjectFormDialog } from "./subject-form-dialog";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useListReload } from "@/lib/api/use-list-reload";
import { useTranslation } from "@/components/providers/i18n-provider";
import type { PagedResult, SubjectDto } from "@/lib/api/types";

export function SubjectsView({ initial }: { initial: PagedResult<SubjectDto> }) {
  const { t, tx, n } = useTranslation();

  const [result, setResult] = useState(initial);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SubjectDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SubjectDto | null>(null);

  const load = useCallback(async () => {
    const data = await apiClient.get<PagedResult<SubjectDto>>("/api/v1/admin/subjects", {
      page,
      pageSize: 20,
      sortBy: "name",
      search: search || undefined,
      isActive: active === "" ? undefined : active === "active",
    });

    setResult(data);
  }, [page, search, active]);

  const { isPending, reload: refresh } = useListReload(load);
  const hasFilters = Boolean(search || active);

  const columns: Column<SubjectDto>[] = [
    {
      key: "name",
      header: t.subjects.name,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="truncate font-[family-name:var(--font-mono-code)] text-xs text-muted-foreground">
            {row.code}
          </p>
        </div>
      ),
    },
    {
      key: "description",
      header: t.subjects.description,
      secondary: true,
      cell: (row) => (
        <p className="max-w-xs truncate text-sm text-muted-foreground">
          {row.description ?? "—"}
        </p>
      ),
    },
    {
      key: "offerings",
      header: t.subjects.offerings,
      className: "text-end",
      cell: (row) => (
        <span className="tabular text-sm">
          {tx(t.subjects.classCount, { count: n(row.offeringCount) })}
        </span>
      ),
    },
    {
      key: "status",
      header: t.common.status,
      cell: (row) => (
        <StatusPill tone={row.isActive ? "success" : "neutral"}>
          {row.isActive ? t.users.active : t.users.inactive}
        </StatusPill>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.common.actions}</span>,
      className: "w-10 text-end",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-xs" aria-label={t.common.actions}>
                <MoreHorizontal className="size-3.5" aria-hidden />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(row)}>
              <Pencil className="size-3.5" aria-hidden />
              {t.common.edit}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleting(row)}
              className="text-destructive data-highlighted:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
              {t.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.subjects.title}
        description={t.subjects.subtitle}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            {t.subjects.newSubject}
          </Button>
        }
      />

      <FadeInUp delay={0.04} className="space-y-3">
        <FilterBar
          hasFilters={hasFilters}
          onClear={() => {
            setSearch("");
            setActive("");
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
            value={active}
            onChange={(value) => {
              setActive(value);
              setPage(1);
            }}
            label={t.common.status}
            width="w-32"
            options={[
              { value: "active", label: t.users.active },
              { value: "inactive", label: t.users.inactive },
            ]}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={result.items}
          getRowKey={(row) => row.id}
          loading={isPending}
          emptyIcon={BookOpen}
          emptyTitle={hasFilters ? t.common.noResults : t.subjects.empty}
        />

        <Pagination result={result} onPageChange={setPage} />
      </FadeInUp>

      <SubjectFormDialog
        open={creating || editing !== null}
        entity={editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t.common.delete}
        description={
          deleting ? tx(t.subjects.deleteConfirm, { name: deleting.name }) : ""
        }
        confirmLabel={t.common.delete}
        onConfirm={async () => {
          if (!deleting) return;

          try {
            await apiClient.delete(`/api/v1/admin/subjects/${deleting.id}`);
            toast.success(t.subjects.deleted);
            refresh();
          } catch (error) {
            toast.error(
              error instanceof ClientApiError ? error.message : t.errors.generic,
            );
          }
        }}
      />
    </div>
  );
}
