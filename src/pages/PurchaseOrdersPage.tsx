import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'

import { FilterSelect } from '@/components/common/FilterSelect'
import { ListError } from '@/components/common/PageParts'
import { DataTable } from '@/components/data-table/DataTable'
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect'
import { PurchaseOrderFormDialog } from '@/components/procurement/PurchaseOrderFormDialog'
import { PurchaseOrderStatusBadge } from '@/components/procurement/PurchaseOrderStatusBadge'
import { SupplierSelect } from '@/components/procurement/SupplierSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/auth/usePermissions'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import {
  useOpenPurchaseOrdersQuery,
  usePurchaseOrdersQuery,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from '@/api/procurement'
import { formatDate } from '@/lib/inventory'
import { minorToMajorString } from '@/lib/money'
import { PO_STATUS_LABEL, PO_STATUSES } from '@/lib/procurement'

const PAGE_SIZE = 20

const rupees = (money: { amountMinor?: number } | undefined) =>
  money?.amountMinor === undefined ? '—' : `₹${minorToMajorString(money.amountMinor)}`

function PurchaseOrdersPage() {
  useBreadcrumb([{ label: 'Procurement' }, { label: 'Purchase orders' }])
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canWrite = has('procurement.po.write')
  const [params] = useSearchParams()

  const [view, setView] = React.useState<'all' | 'open'>('all')
  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<PurchaseOrderStatus | ''>('')
  const [supplierId, setSupplierId] = React.useState(params.get('supplier') ?? '')
  const [warehouseId, setWarehouseId] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const all = usePurchaseOrdersQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    status: status === '' ? undefined : status,
    supplierId: supplierId || undefined,
    warehouseId: warehouseId || undefined,
    search: search.trim(),
    expectedFrom: from,
    expectedTo: to,
  })
  const open = useOpenPurchaseOrdersQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    supplierId: supplierId || undefined,
    warehouseId: warehouseId || undefined,
  })
  const list = view === 'open' ? open : all

  function filter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPageIndex(0)
    }
  }

  const columns: ColumnDef<PurchaseOrder, unknown>[] = [
    {
      id: 'number',
      header: 'PO',
      cell: ({ row }) => <span className="font-mono">{row.original.poNumber}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <PurchaseOrderStatusBadge status={row.original.status} />,
    },
    {
      id: 'supplier',
      header: 'Supplier',
      cell: ({ row }) => (
        <span>
          <span className="font-mono">{row.original.supplierCode}</span> {row.original.supplierName}
        </span>
      ),
    },
    {
      id: 'warehouse',
      header: 'Into',
      cell: ({ row }) => <span className="font-mono">{row.original.warehouseCode}</span>,
    },
    { id: 'expected', header: 'Expected', cell: ({ row }) => formatDate(row.original.expectedOn) },
    { id: 'ordered', header: 'Ordered', cell: ({ row }) => row.original.quantityOrdered },
    { id: 'received', header: 'Received', cell: ({ row }) => row.original.quantityReceived },
    {
      id: 'outstanding',
      header: 'Outstanding',
      cell: ({ row }) => <b>{row.original.quantityOutstanding}</b>,
    },
    { id: 'total', header: 'Total', cell: ({ row }) => rupees(row.original.totalCost) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Purchase orders</h1>
        <Button
          disabled={!canWrite}
          title={canWrite ? undefined : 'Needs procurement.po.write'}
          onClick={() => setCreating(true)}
        >
          <PlusIcon /> New purchase order
        </Button>
      </div>

      <div role="tablist" aria-label="Purchase order views" className="flex gap-1 border-b pb-2">
        {(
          [
            ['all', 'All orders'],
            ['open', 'Open'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            role="tab"
            aria-selected={view === key}
            size="sm"
            variant={view === key ? 'default' : 'ghost'}
            onClick={() => filter(setView)(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {view === 'open' && (
        <p className="-mt-2 text-sm text-muted-foreground">
          What suppliers still owe: approved and partially received orders, soonest expected first.
          Orders with no date come last. Drafts are not outstanding with anybody.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        {view === 'all' && (
          <>
            <Input
              placeholder="PO number, e.g. PO-000001"
              aria-label="PO number"
              value={search}
              onChange={(e) => filter(setSearch)(e.target.value)}
              className="w-56"
            />
            <FilterSelect
              value={status}
              onChange={filter(setStatus)}
              ariaLabel="Status filter"
              allLabel="All statuses"
              options={PO_STATUSES.map((s) => ({ value: s, label: PO_STATUS_LABEL[s] }))}
            />
          </>
        )}
        <SupplierSelect
          value={supplierId}
          onChange={filter(setSupplierId)}
          ariaLabel="Supplier filter"
          allLabel="All suppliers"
        />
        <WarehouseSelect
          value={warehouseId}
          onChange={filter(setWarehouseId)}
          ariaLabel="Warehouse filter"
          allLabel="All warehouses"
        />
        {view === 'all' && (
          <>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Expected from
              <Input
                type="date"
                aria-label="Expected from"
                value={from}
                onChange={(e) => filter(setFrom)(e.target.value)}
                className="w-40"
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Expected to (inclusive)
              <Input
                type="date"
                aria-label="Expected to"
                value={to}
                onChange={(e) => filter(setTo)(e.target.value)}
                className="w-40"
              />
            </label>
          </>
        )}
      </div>

      {list.isError && <ListError error={list.error} what="Purchase orders" />}

      <DataTable
        columns={columns}
        data={list.data?.content ?? []}
        isLoading={list.isLoading}
        emptyMessage={
          view === 'open'
            ? 'Nothing is outstanding with any supplier.'
            : 'No purchase orders match these filters.'
        }
        onRowClick={(po) => navigate(`/procurement/purchase-orders/${po.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: list.data?.totalPages ?? 0,
          totalElements: list.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <PurchaseOrderFormDialog
        open={creating}
        onOpenChange={setCreating}
        initialSupplierId={supplierId || undefined}
        onSaved={(po) => navigate(`/procurement/purchase-orders/${po.id}`)}
      />
    </div>
  )
}

export default PurchaseOrdersPage
