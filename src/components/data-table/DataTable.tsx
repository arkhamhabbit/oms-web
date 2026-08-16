import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface ServerPagination {
  pageIndex: number
  pageSize: number
  pageCount: number
  totalElements: number
  onPageIndexChange: (pageIndex: number) => void
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  /** Renders a sub-row of content beneath an expanded row. Omit to disable expansion. */
  renderSubRow?: (row: TData) => React.ReactNode
  isLoading?: boolean
  emptyMessage?: string
  pageSize?: number
  /**
   * When set, `data` is treated as one already-fetched page rather than the whole dataset —
   * pagination is driven by these props instead of TanStack Table's own row-slicing. Required
   * for any screen backed by a paginated API (D: "the API already does it, do not fetch
   * everything and filter client-side").
   */
  serverPagination?: ServerPagination
}

function DataTable<TData>({
  columns,
  data,
  renderSubRow,
  isLoading = false,
  emptyMessage = 'No results.',
  pageSize = 10,
  serverPagination,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [expanded, setExpanded] = React.useState<ExpandedState>({})

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      expanded,
      ...(serverPagination && {
        pagination: { pageIndex: serverPagination.pageIndex, pageSize: serverPagination.pageSize },
      }),
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    getRowCanExpand: () => !!renderSubRow,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!serverPagination,
    pageCount: serverPagination?.pageCount,
    initialState: { pagination: { pageSize } },
  })

  const pageIndex = serverPagination?.pageIndex ?? table.getState().pagination.pageIndex
  const canPreviousPage = serverPagination
    ? serverPagination.pageIndex > 0
    : table.getCanPreviousPage()
  const canNextPage = serverPagination
    ? serverPagination.pageIndex + 1 < serverPagination.pageCount
    : table.getCanNextPage()
  const goPreviousPage = () =>
    serverPagination ? serverPagination.onPageIndexChange(pageIndex - 1) : table.previousPage()
  const goNextPage = () =>
    serverPagination ? serverPagination.onPageIndexChange(pageIndex + 1) : table.nextPage()
  const pageCount = serverPagination?.pageCount ?? table.getPageCount()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {renderSubRow && <TableHead className="w-8" />}
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sortDirection = header.column.getIsSorted()
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 select-none"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDirection === 'asc' && <ChevronUp className="size-3.5" />}
                          {sortDirection === 'desc' && <ChevronDown className="size-3.5" />}
                          {!sortDirection && <ChevronsUpDown className="size-3.5 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (renderSubRow ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (renderSubRow ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow data-state={row.getIsSelected() && 'selected'}>
                    {renderSubRow && (
                      <TableCell>
                        {row.getCanExpand() && (
                          <button
                            type="button"
                            aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
                            onClick={row.getToggleExpandedHandler()}
                            className="flex size-6 items-center justify-center rounded hover:bg-accent"
                          >
                            {row.getIsExpanded() ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </button>
                        )}
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {renderSubRow && row.getIsExpanded() && (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} className="bg-muted/30">
                        {renderSubRow(row.original)}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {pageIndex + 1} of {Math.max(1, pageCount)}
          {serverPagination && ` · ${serverPagination.totalElements} total`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPreviousPage} disabled={!canPreviousPage}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={goNextPage} disabled={!canNextPage}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

export { DataTable }
