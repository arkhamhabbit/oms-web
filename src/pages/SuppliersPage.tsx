import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'

import { ActiveBadge } from '@/components/common/ActiveBadge'
import { FilterSelect } from '@/components/common/FilterSelect'
import { ListError } from '@/components/common/PageParts'
import { DataTable } from '@/components/data-table/DataTable'
import { SupplierFormDialog } from '@/components/procurement/SupplierFormDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/auth/usePermissions'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { useSuppliersQuery, type Supplier } from '@/api/procurement'

const PAGE_SIZE = 20

type StatusFilter = 'ACTIVE' | 'INACTIVE'

function SuppliersPage() {
  useBreadcrumb([{ label: 'Procurement' }, { label: 'Suppliers' }])
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canWrite = has('procurement.supplier.write')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<StatusFilter | ''>('')
  const [search, setSearch] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const suppliers = useSuppliersQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    active: status === '' ? undefined : status === 'ACTIVE',
    search: search.trim(),
  })

  const columns: ColumnDef<Supplier, unknown>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: ({ row }) => <span className="font-mono">{row.original.code}</span>,
    },
    { id: 'name', header: 'Name', cell: ({ row }) => row.original.name },
    { id: 'gstin', header: 'GSTIN', cell: ({ row }) => row.original.gstin ?? '' },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => [row.original.city, row.original.state].filter(Boolean).join(', '),
    },
    {
      id: 'terms',
      header: 'Payment terms',
      cell: ({ row }) => `${row.original.paymentTermsDays ?? 0} days`,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <ActiveBadge active={row.original.active} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Suppliers</h1>
        <Button
          disabled={!canWrite}
          title={canWrite ? undefined : 'Needs procurement.supplier.write'}
          onClick={() => setCreating(true)}
        >
          <PlusIcon /> New supplier
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Input
          placeholder="Search by code, name or GSTIN"
          aria-label="Search suppliers"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPageIndex(0)
          }}
          className="w-72"
        />
        <FilterSelect
          value={status}
          onChange={(next) => {
            setStatus(next)
            setPageIndex(0)
          }}
          ariaLabel="Status filter"
          allLabel="Active and inactive"
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
        />
      </div>

      {suppliers.isError && <ListError error={suppliers.error} what="Suppliers" />}

      <DataTable
        columns={columns}
        data={suppliers.data?.content ?? []}
        isLoading={suppliers.isLoading}
        emptyMessage="No suppliers match these filters."
        onRowClick={(s) => navigate(`/procurement/suppliers/${s.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: suppliers.data?.totalPages ?? 0,
          totalElements: suppliers.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <SupplierFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(s) => navigate(`/procurement/suppliers/${s.id}`)}
      />
    </div>
  )
}

export default SuppliersPage
