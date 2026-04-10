"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchKey?: keyof T;
  pageSize?: number;
  totalItems?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (query: string) => void;
  serverSide?: boolean;
  isLoading?: boolean;
  emptyState?: ReactNode;
  toolbar?: ReactNode;
}

function getRowValue<T extends object>(row: T, key: keyof T) {
  return (row as Record<string, unknown>)[String(key)];
}

function getRowId<T extends object>(row: T) {
  const maybeId = (row as { id?: string | number }).id;
  return maybeId;
}

export function DataTable<T extends object>({
  data,
  columns,
  searchPlaceholder = "Search...",
  searchKey,
  pageSize = 10,
  totalItems,
  currentPage = 1,
  onPageChange,
  onSearch,
  serverSide = false,
  isLoading = false,
  emptyState,
  toolbar,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [localPage, setLocalPage] = useState(1);

  const page = serverSide ? currentPage : localPage;

  const filtered = useMemo(() => {
    if (serverSide || !searchKey || !search) return data;

    return data.filter((row) => {
      const value = String(getRowValue(row, searchKey) ?? "").toLowerCase();
      return value.includes(search.toLowerCase());
    });
  }, [data, search, searchKey, serverSide]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;

    return [...filtered].sort((left, right) => {
      const leftValue = getRowValue(left, sortKey);
      const rightValue = getRowValue(right, sortKey);

      if (leftValue == null) return 1;
      if (rightValue == null) return -1;

      const comparison =
        leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;

      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [filtered, sortDir, sortKey]);

  const total = serverSide ? (totalItems ?? data.length) : sorted.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedData = serverSide
    ? data
    : sorted.slice((page - 1) * pageSize, page * pageSize);

  function handleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(key);
    setSortDir("asc");
  }

  function handlePageChange(nextPage: number) {
    if (serverSide) {
      onPageChange?.(nextPage);
      return;
    }

    setLocalPage(nextPage);
  }

  function handleSearch(value: string) {
    setSearch(value);
    if (serverSide) {
      onSearch?.(value);
      return;
    }

    setLocalPage(1);
  }

  function SortIcon({ columnKey }: { columnKey: keyof T }) {
    if (sortKey !== columnKey) {
      return <ChevronsUpDown className="h-3.5 w-3.5 text-neutral-300" />;
    }

    return sortDir === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-300" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-300" />
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200/60 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-col gap-3 border-b border-neutral-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-transparent pl-9 pr-3 text-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-200 dark:border-neutral-700 dark:focus:border-neutral-500"
          />
        </div>
        {toolbar}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400",
                    column.sortable &&
                      "cursor-pointer select-none hover:text-neutral-700 dark:hover:text-neutral-200"
                  )}
                  style={{ width: column.width }}
                  onClick={() =>
                    column.sortable && handleSort(column.key as keyof T)
                  }
                >
                  <div className="flex items-center gap-1">
                    {column.header}
                    {column.sortable && (
                      <SortIcon columnKey={column.key as keyof T} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr
                  key={index}
                  className="border-b border-neutral-50 dark:border-neutral-800/50"
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3.5">
                      <div className="h-4 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12">
                  {emptyState ?? (
                    <p className="text-center text-sm text-neutral-400">
                      No results found
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout">
                {paginatedData.map((row, index) => (
                  <motion.tr
                    key={getRowId(row) ?? index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.02 }}
                    className="border-b border-neutral-50 transition-colors hover:bg-neutral-50/50 dark:border-neutral-800/50 dark:hover:bg-neutral-800/20"
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3.5 text-sm">
                        {column.render(row, index)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <p className="text-sm text-neutral-500">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
              const pageNumber = index + 1;

              return (
                <button
                  key={pageNumber}
                  onClick={() => handlePageChange(pageNumber)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-sm",
                    page === pageNumber
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  )}
                >
                  {pageNumber}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
