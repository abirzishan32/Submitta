"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./empty-state";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Hidden below `md`, for columns that are useful but not essential. */
  secondary?: boolean;
  className?: string;
}

/**
 * Table for list pages.
 *
 * Loading, empty and populated are all handled here so no page re-implements
 * them — and so a slow request always shows a skeleton of the right shape
 * rather than a spinner that says nothing about what is coming.
 *
 * The table scrolls inside its own container: a wide table must never make the
 * whole page scroll sideways.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  loadingRows = 5,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  loadingRows?: number;
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "h-9 text-xs font-medium text-muted-foreground",
                    column.secondary && "hidden md:table-cell",
                    column.className,
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading
              ? Array.from({ length: loadingRows }).map((_, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-transparent">
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(column.secondary && "hidden md:table-cell")}
                      >
                        {/* Varying widths, so a loading table reads as content
                            arriving rather than as a placeholder grid. */}
                        <Skeleton
                          className="h-4"
                          style={{ width: `${55 + ((rowIndex * 13 + column.key.length * 7) % 35)}%` }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow
                    key={getRowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && "cursor-pointer")}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          "py-2.5",
                          column.secondary && "hidden md:table-cell",
                          column.className,
                        )}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
