import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "../../../lib/cn";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { ErrorBanner } from "./error-banner";
import { Input } from "./input";
import { Pagination } from "./pagination";
import { Skeleton } from "./skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Provide to make the column sortable (client-side). */
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  headClassName?: string;
  /** Hide the column below a breakpoint. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  align?: "left" | "right" | "center";
};

type SortState = { id: string; dir: "asc" | "desc" } | null;

export type DataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[] | null | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Controlled search box (server-side search). */
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  /** Client-side filter — when provided, the search box filters rows locally. */
  filterFn?: (row: T, query: string) => boolean;
  /** Server-side pagination controls. */
  pagination?: DataTablePagination;
  /** Paginate the given rows locally with this page size. */
  clientPageSize?: number;
  toolbar?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: typeof Inbox;
  initialSort?: NonNullable<SortState>;
  skeletonRows?: number;
  className?: string;
  /** Rendered below the table (e.g. totals). */
  footer?: ReactNode;
  dense?: boolean;
};

const hideClass: Record<NonNullable<DataTableColumn<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  search,
  filterFn,
  pagination,
  clientPageSize,
  toolbar,
  rowActions,
  onRowClick,
  rowClassName,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  emptyIcon = Inbox,
  initialSort,
  skeletonRows = 6,
  className,
  footer,
  dense,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort ?? null);
  const [localQuery, setLocalQuery] = useState("");
  const [localPage, setLocalPage] = useState(1);

  const query = search ? search.value : localQuery;
  const setQuery = (value: string) => {
    if (search) search.onChange(value);
    else setLocalQuery(value);
    setLocalPage(1);
  };

  const processed = useMemo(() => {
    let list = rows ?? [];
    if (filterFn && query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((row) => filterFn(row, q));
    }
    if (sort) {
      const column = columns.find((c) => c.id === sort.id);
      if (column?.sortValue) {
        const sv = column.sortValue;
        list = [...list].sort((a, b) => {
          const result = compare(sv(a), sv(b));
          return sort.dir === "asc" ? result : -result;
        });
      }
    }
    return list;
  }, [rows, filterFn, query, sort, columns]);

  const pageRows = useMemo(() => {
    if (!clientPageSize) return processed;
    const start = (localPage - 1) * clientPageSize;
    return processed.slice(start, start + clientPageSize);
  }, [processed, clientPageSize, localPage]);

  const showSearch = !!search || !!filterFn;
  const colCount = columns.length + (rowActions ? 1 : 0);

  const toggleSort = (id: string) => {
    setSort((current) => {
      if (!current || current.id !== id) return { id, dir: "asc" };
      if (current.dir === "asc") return { id, dir: "desc" };
      return null;
    });
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showSearch || toolbar ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {showSearch ? (
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={search?.placeholder ?? "Search…"}
                className="pl-8 pr-8"
                aria-label="Search"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : null}
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} onRetry={onRetry} retrying={loading} /> : null}

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const sortable = !!column.sortValue;
                const active = sort?.id === column.id;
                return (
                  <TableHead
                    key={column.id}
                    className={cn(
                      column.hideBelow && hideClass[column.hideBelow],
                      column.align && alignClass[column.align],
                      column.headClassName,
                    )}
                    aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className={cn(
                          "-ml-2 inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-medium uppercase tracking-wide hover:bg-muted hover:text-foreground",
                          active && "text-foreground",
                        )}
                      >
                        {column.header}
                        {active ? (
                          sort?.dir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
              {rowActions ? <TableHead className="w-[1%] text-right" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !rows ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={`s-${i}`} className="hover:bg-transparent">
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(column.hideBelow && hideClass[column.hideBelow], dense && "py-2")}
                    >
                      <Skeleton className="h-4 w-[60%]" />
                    </TableCell>
                  ))}
                  {rowActions ? (
                    <TableCell>
                      <Skeleton className="ml-auto h-8 w-8" />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            ) : pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colCount} className="p-0">
                  <EmptyState
                    icon={emptyIcon}
                    title={error ? "Could not load" : emptyTitle}
                    description={
                      error
                        ? undefined
                        : query
                          ? `No results match “${query}”.`
                          : emptyDescription
                    }
                    action={
                      query ? (
                        <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                          Clear search
                        </Button>
                      ) : (
                        emptyAction
                      )
                    }
                    className="rounded-none border-0 bg-transparent"
                    compact
                  />
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer", rowClassName?.(row))}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        column.hideBelow && hideClass[column.hideBelow],
                        column.align && alignClass[column.align],
                        dense && "py-2",
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  {rowActions ? (
                    <TableCell className={cn("text-right", dense && "py-2")} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">{rowActions(row)}</div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {footer ? <div className="border-t border-border px-3 py-2 text-sm">{footer}</div> : null}
      </div>

      {pagination ? (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      ) : clientPageSize && processed.length > clientPageSize ? (
        <Pagination
          page={localPage}
          pageSize={clientPageSize}
          total={processed.length}
          onPageChange={setLocalPage}
        />
      ) : null}
    </div>
  );
}

export { DataTable };
