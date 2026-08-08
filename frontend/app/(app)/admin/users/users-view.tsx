"use client";

import { useCallback, useState } from "react";
import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  Users as UsersIcon,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { SearchInput, Pagination, FilterBar } from "@/components/common/list-controls";
import { FilterSelect } from "@/components/common/filter-select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { StatusPill } from "@/components/common/status-badge";
import { FadeInUp } from "@/components/motion/primitives";
import { UserFormDialog } from "./user-form-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { apiClient, ClientApiError } from "@/lib/api/client";
import { useListReload } from "@/lib/api/use-list-reload";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatDate, formatRelative, initialsOf } from "@/lib/format";
import type { PagedResult, UserDto, UserRole } from "@/lib/api/types";

export function UsersView({ initial }: { initial: PagedResult<UserDto> }) {
  const { t, tx, locale } = useTranslation();

  const [result, setResult] = useState(initial);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<UserDto | null>(null);
  const [confirming, setConfirming] = useState<
    { user: UserDto; kind: "delete" | "deactivate" } | null
  >(null);

  const load = useCallback(async () => {
    const data = await apiClient.get<PagedResult<UserDto>>("/api/v1/admin/users", {
      page,
      pageSize: 20,
      sortBy: "fullName",
      search: search || undefined,
      role: role || undefined,
      isActive: active === "" ? undefined : active === "active",
    });

    setResult(data);
  }, [page, search, role, active]);

  const { isPending, reload: refresh } = useListReload(load);

  const hasFilters = Boolean(search || role || active);

  function clearFilters() {
    setSearch("");
    setRole("");
    setActive("");
    setPage(1);
  }

  /** Wraps a mutation so every failure surfaces the API's own message. */
  async function run(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      toast.success(successMessage);
      refresh();
    } catch (error) {
      toast.error(
        error instanceof ClientApiError ? error.message : t.errors.generic,
      );
    }
  }

  const columns: Column<UserDto>[] = [
    {
      key: "name",
      header: t.users.fullName,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[0.6875rem] font-medium text-accent-foreground">
            {initialsOf(row.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: t.users.role,
      cell: (row) => <StatusPill tone="info">{t.roles[row.role]}</StatusPill>,
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
      key: "lastLogin",
      header: t.users.lastLogin,
      secondary: true,
      cell: (row) => (
        <span className="text-xs text-muted-foreground tabular">
          {row.lastLoginAt
            ? formatRelative(row.lastLoginAt, locale)
            : t.users.neverLoggedIn}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: t.users.createdAt,
      secondary: true,
      cell: (row) => (
        <span className="text-xs text-muted-foreground tabular">
          {formatDate(row.createdAt, locale)}
        </span>
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
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setEditing(row)}>
              <Pencil className="size-3.5" aria-hidden />
              {t.common.edit}
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => setResetting(row)}>
              <KeyRound className="size-3.5" aria-hidden />
              {t.users.resetPassword}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {row.isActive ? (
              <DropdownMenuItem
                onClick={() => setConfirming({ user: row, kind: "deactivate" })}
              >
                <UserX className="size-3.5" aria-hidden />
                {t.users.deactivate}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() =>
                  run(
                    () =>
                      apiClient.patch(`/api/v1/admin/users/${row.id}/status`, {
                        isActive: true,
                      }),
                    t.users.updated,
                  )
                }
              >
                <UserCheck className="size-3.5" aria-hidden />
                {t.users.activate}
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => setConfirming({ user: row, kind: "delete" })}
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
        title={t.users.title}
        description={t.users.subtitle}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            {t.users.newUser}
          </Button>
        }
      />

      <FadeInUp delay={0.04} className="space-y-3">
        <FilterBar hasFilters={hasFilters} onClear={clearFilters}>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            className="w-full sm:w-64"
          />

          <FilterSelect
            value={role}
            onChange={(value) => {
              setRole(value);
              setPage(1);
            }}
            label={t.users.role}
            width="w-36"
            options={(["Admin", "Teacher", "Student"] as UserRole[]).map((value) => ({
              value,
              label: t.roles[value],
            }))}
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
          emptyIcon={UsersIcon}
          emptyTitle={t.users.empty}
        />

        <Pagination result={result} onPageChange={setPage} />
      </FadeInUp>

      <UserFormDialog
        open={creating || editing !== null}
        user={editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        onSaved={refresh}
      />

      <ResetPasswordDialog
        user={resetting}
        onOpenChange={(open) => !open && setResetting(null)}
      />

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming?.kind === "delete" ? t.common.delete : t.users.deactivate
        }
        description={
          confirming
            ? tx(
                confirming.kind === "delete"
                  ? t.users.deleteConfirm
                  : t.users.deactivateConfirm,
                { name: confirming.user.fullName },
              )
            : ""
        }
        confirmLabel={
          confirming?.kind === "delete" ? t.common.delete : t.users.deactivate
        }
        onConfirm={async () => {
          if (!confirming) return;

          await run(
            () =>
              confirming.kind === "delete"
                ? apiClient.delete(`/api/v1/admin/users/${confirming.user.id}`)
                : apiClient.patch(
                    `/api/v1/admin/users/${confirming.user.id}/status`,
                    { isActive: false },
                  ),
            confirming.kind === "delete" ? t.users.deleted : t.users.updated,
          );
        }}
      />
    </div>
  );
}
