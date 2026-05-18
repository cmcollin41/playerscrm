"use client"

import { useState, type ReactNode } from "react"
import { MixerHorizontalIcon } from "@radix-ui/react-icons"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table as TableInstance,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  pageSize?: number
  initialSorting?: SortingState
  initialColumnFilters?: ColumnFiltersState
  initialColumnVisibility?: VisibilityState
  enableRowSelection?: boolean
  getRowId?: (row: TData, index: number) => string
  onRowClick?: (row: TData) => void
  toolbar?: (table: TableInstance<TData>) => ReactNode
  bulkActions?: (
    selectedRows: Row<TData>[],
    clearSelection: () => void,
  ) => ReactNode
  emptyState?: ReactNode
  showColumnVisibility?: boolean
  showPagination?: boolean
  showRowCount?: boolean
  className?: string
  /** Singular/plural noun for the row count display, e.g. "user(s)" */
  noun?: string
  /** Enables global filter state. Pair with `globalFilterFn` for custom matching. */
  enableGlobalFilter?: boolean
  globalFilterFn?: FilterFn<TData>
  /**
   * Replaces the default `<Table>` body rendering. When provided, the caller
   * fully owns row markup (e.g. card/feed layouts). Pagination, filtering,
   * sorting, and selection still run through the underlying TanStack table.
   */
  renderRows?: (table: TableInstance<TData>) => ReactNode
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageSize = 30,
  initialSorting = [],
  initialColumnFilters = [],
  initialColumnVisibility = {},
  enableRowSelection = false,
  getRowId,
  onRowClick,
  toolbar,
  bulkActions,
  emptyState,
  showColumnVisibility = true,
  showPagination = true,
  showRowCount = true,
  className,
  noun = "row(s)",
  enableGlobalFilter = false,
  globalFilterFn,
  renderRows,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] =
    useState<ColumnFiltersState>(initialColumnFilters)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialColumnVisibility,
  )
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [globalFilter, setGlobalFilter] = useState("")

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: enableGlobalFilter ? setGlobalFilter : undefined,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection,
    getRowId,
    initialState: { pagination: { pageSize } },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(enableGlobalFilter ? { globalFilter } : {}),
    },
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const clearSelection = () => setRowSelection({})
  const showHeader = !!toolbar || showColumnVisibility

  return (
    <div className={cn("w-full space-y-4", className)}>
      {showHeader && (
        <div className="flex items-center gap-4">
          {toolbar?.(table)}
          {showColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="ml-auto flex items-center justify-between"
                >
                  <MixerHorizontalIcon className="mr-2 h-4 w-4" /> View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {bulkActions && selectedRows.length > 0 && (
        <div className="bg-muted/30 flex items-center gap-2 rounded-md border p-2">
          <span className="text-muted-foreground text-sm">
            {selectedRows.length} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={clearSelection}
          >
            Clear
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {bulkActions(selectedRows, clearSelection)}
          </div>
        </div>
      )}

      {renderRows ? (
        renderRows(table)
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      onRowClick && "cursor-pointer",
                    )}
                    onClick={
                      onRowClick ? () => onRowClick(row.original) : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {emptyState ?? (
                      <p className="text-muted-foreground text-sm">
                        No results
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {showPagination && (
        <div className="flex items-center justify-between">
          {showRowCount ? (
            <div className="text-muted-foreground text-sm">
              {table.getFilteredRowModel().rows.length} {noun}
              {enableRowSelection && selectedRows.length > 0 && (
                <> · {selectedRows.length} selected</>
              )}
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
