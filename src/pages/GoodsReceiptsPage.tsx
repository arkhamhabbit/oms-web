import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'

import { ListError } from '@/components/common/PageParts'
import { DataTable } from '@/components/data-table/DataTable'
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/auth/usePermissions'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { useGoodsReceiptsQuery, type GoodsReceipt } from '@/api/procurement'
import { formatDate } from '@/lib/inventory'
import { minorToMajorString } from '@/lib/money'

const PAGE_SIZE = 20

function GoodsReceiptsPage() {
  useBreadcrumb([{ label: 'Procurement' }, { label: 'Goods receipts' }])
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canCreate = has('procurement.grn.create')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const [warehouseId, setWarehouseId] = React.useState('')

  const receipts = useGoodsReceiptsQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    search: search.trim(),
    warehouseId: warehouseId || undefined,
  })

  const columns: ColumnDef<GoodsReceipt, unknown>[] = [
    {
      id: 'grn',
      header: 'Receipt',
      cell: ({ row }) => <span className="font-mono">{row.original.grnNumber}</span>,
    },
    {
      id: 'po',
      header: 'Purchase order',
      cell: ({ row }) => (
        <Link
          className="font-mono underline"
          to={`/procurement/purchase-orders/${row.original.purchaseOrderId}`}
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.poNumber}
        </Link>
      ),
    },
    {
      id: 'warehouse',
      header: 'Into',
      cell: ({ row }) => <span className="font-mono">{row.original.warehouseCode}</span>,
    },
    {
      id: 'received',
      header: 'Received on',
      cell: ({ row }) => formatDate(row.original.receivedOn),
    },
    {
      id: 'invoice',
      header: 'Invoice',
      cell: ({ row }) => row.original.supplierInvoiceNumber ?? '',
    },
    { id: 'accepted', header: 'Accepted', cell: ({ row }) => row.original.quantityReceived },
    { id: 'rejected', header: 'Rejected', cell: ({ row }) => row.original.quantityRejected },
    {
      id: 'cost',
      header: 'Cost',
      cell: ({ row }) =>
        row.original.totalCost?.amountMinor === undefined
          ? '—'
          : `₹${minorToMajorString(row.original.totalCost.amountMinor)}`,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Goods receipts</h1>
        <Button
          disabled={!canCreate}
          title={canCreate ? undefined : 'Needs procurement.grn.create'}
          onClick={() => navigate('/procurement/goods-receipts/new')}
        >
          <PlusIcon /> Post a receipt
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Input
          placeholder="Receipt number or supplier's invoice number"
          aria-label="Search receipts"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPageIndex(0)
          }}
          className="w-80"
        />
        <WarehouseSelect
          value={warehouseId}
          onChange={(next) => {
            setWarehouseId(next)
            setPageIndex(0)
          }}
          ariaLabel="Warehouse filter"
          allLabel="All warehouses"
        />
      </div>

      {receipts.isError && <ListError error={receipts.error} what="Goods receipts" />}

      <DataTable
        columns={columns}
        data={receipts.data?.content ?? []}
        isLoading={receipts.isLoading}
        emptyMessage="No receipts match these filters."
        onRowClick={(g) => navigate(`/procurement/goods-receipts/${g.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: receipts.data?.totalPages ?? 0,
          totalElements: receipts.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />
    </div>
  )
}

export default GoodsReceiptsPage
