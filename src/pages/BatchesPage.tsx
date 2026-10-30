import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'

import { ListError } from '@/components/common/PageParts'
import { DataTable } from '@/components/data-table/DataTable'
import { BatchFormDialog } from '@/components/inventory/BatchFormDialog'
import { VariantChoice, type ChosenVariant } from '@/components/inventory/VariantChoice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/auth/usePermissions'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { useBatchesQuery, type Batch } from '@/api/inventory'
import { formatDate } from '@/lib/dates'
import { formatDateTime } from '@/lib/dates'

const PAGE_SIZE = 20

function BatchesPage() {
  useBreadcrumb([{ label: 'Inventory' }, { label: 'Batches' }])
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canCreate = has('inventory.adjust')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [variant, setVariant] = React.useState<ChosenVariant | null>(null)
  const [withinDays, setWithinDays] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const days = /^\d+$/.test(withinDays.trim()) ? Number.parseInt(withinDays, 10) : undefined
  const batches = useBatchesQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    variantId: variant?.id,
    expiringWithinDays: days,
    search: search.trim(),
  })

  const columns: ColumnDef<Batch, unknown>[] = [
    {
      id: 'number',
      header: 'Batch',
      cell: ({ row }) => <span className="font-mono">{row.original.batchNumber}</span>,
    },
    {
      // The batch response carries only the variant id, not its SKU (recorded as a contract gap).
      id: 'variant',
      header: 'Variant',
      cell: ({ row }) => (
        <span className="font-mono text-xs" title={row.original.variantId}>
          {row.original.variantId?.slice(0, 8)}…
        </span>
      ),
    },
    {
      id: 'mfd',
      header: 'Manufactured',
      cell: ({ row }) => formatDate(row.original.manufacturedOn),
    },
    {
      id: 'exp',
      header: 'Expires',
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          {row.original.expiresOn ? formatDate(row.original.expiresOn) : 'No expiry'}
          {row.original.expired && <Badge variant="destructive">Expired</Badge>}
        </span>
      ),
    },
    { id: 'created', header: 'Created', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Batches</h1>
        <Button
          disabled={!canCreate}
          title={canCreate ? undefined : 'Needs inventory.adjust'}
          onClick={() => setCreating(true)}
        >
          <PlusIcon /> New batch
        </Button>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Variant</span>
          <VariantChoice
            value={variant}
            onChange={(next) => {
              setVariant(next)
              setPageIndex(0)
            }}
            ariaLabel="Find a product or SKU to filter batches"
          />
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Expires within (days)
          <Input
            inputMode="numeric"
            aria-label="Expires within days"
            value={withinDays}
            onChange={(e) => {
              setWithinDays(e.target.value)
              setPageIndex(0)
            }}
            className="w-40"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Batch number
          <Input
            aria-label="Search batches"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPageIndex(0)
            }}
            className="w-48"
          />
        </label>
      </div>

      {batches.isError && <ListError error={batches.error} what="Batches" />}

      <DataTable
        columns={columns}
        data={batches.data?.content ?? []}
        isLoading={batches.isLoading}
        emptyMessage="No batches match these filters."
        onRowClick={(b) => navigate(`/inventory/batches/${b.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: batches.data?.totalPages ?? 0,
          totalElements: batches.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <BatchFormDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(b) => navigate(`/inventory/batches/${b.id}`)}
      />
    </div>
  )
}

export default BatchesPage
