import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'

import { DataTable } from '@/components/data-table/DataTable'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PricingStateBadge } from '@/components/pricing/PricingStateBadge'
import { PricingVersionCreateDialog } from '@/components/pricing/PricingVersionCreateDialog'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError } from '@/lib/api-error'
import { PRICING_VERSION_STATUSES } from '@/api/enums.gen'
import {
  usePricingVersionsQuery,
  type PricingVersion,
  type PricingVersionStatus,
} from '@/api/pricing'

const PAGE_SIZE = 20

function formatDate(value: string | undefined) {
  return value ? new Date(value).toLocaleString() : ''
}

function PricingPage() {
  useBreadcrumb([{ label: 'Pricing' }])
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canWrite = has('pricing.write')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<PricingVersionStatus | 'ALL'>('ALL')
  const [createOpen, setCreateOpen] = React.useState(false)

  const versions = usePricingVersionsQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
  })

  const columns: ColumnDef<PricingVersion, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      id: 'state',
      header: 'State',
      cell: ({ row }) => <PricingStateBadge state={row.original.state} />,
    },
    {
      id: 'effectiveFrom',
      header: 'Effective from',
      cell: ({ row }) => formatDate(row.original.effectiveFrom) || '—',
    },
    { id: 'priceCount', header: 'Prices set', cell: ({ row }) => row.original.priceCount ?? 0 },
    { id: 'updatedAt', header: 'Updated', cell: ({ row }) => formatDate(row.original.updatedAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        A pricing version sets the member and lowest prices per variant. Exactly one version is in
        effect at any moment; a change is a new draft, published now or scheduled for later. A
        variant or level a version does not price pays the base selling price.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as PricingVersionStatus | 'ALL')
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-44" aria-label="Status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All versions</SelectItem>
            {PRICING_VERSION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button disabled={!canWrite} onClick={() => setCreateOpen(true)}>
          <PlusIcon /> New draft
        </Button>
      </div>

      {versions.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(versions.error)
            ? versions.error.message
            : 'Pricing versions could not be loaded.'}
        </p>
      )}

      <DataTable
        columns={columns}
        data={versions.data?.content ?? []}
        isLoading={versions.isLoading}
        emptyMessage="No pricing versions match this filter."
        onRowClick={(version) => navigate(`/pricing/${version.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: versions.data?.totalPages ?? 0,
          totalElements: versions.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <PricingVersionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate(`/pricing/${id}`)}
      />
    </div>
  )
}

export default PricingPage
