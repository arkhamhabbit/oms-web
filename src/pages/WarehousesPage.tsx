import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'

import { ActiveBadge } from '@/components/common/ActiveBadge'
import { FilterSelect } from '@/components/common/FilterSelect'
import { ListError } from '@/components/common/PageParts'
import { DataTable } from '@/components/data-table/DataTable'
import { WarehouseFormDialog } from '@/components/inventory/WarehouseFormDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/auth/usePermissions'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { useWarehousesQuery, type Warehouse, type WarehouseType } from '@/api/inventory'
import { WAREHOUSE_TYPE_LABEL, WAREHOUSE_TYPES } from '@/lib/inventory'

const PAGE_SIZE = 20

type StatusFilter = 'ACTIVE' | 'INACTIVE'

function WarehousesPage() {
  useBreadcrumb([{ label: 'Inventory' }, { label: 'Warehouses' }])
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canWrite = has('warehouse.write')

  const [pageIndex, setPageIndex] = React.useState(0)
  const [status, setStatus] = React.useState<StatusFilter | ''>('')
  const [type, setType] = React.useState<WarehouseType | ''>('')
  const [search, setSearch] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const warehouses = useWarehousesQuery({
    page: pageIndex,
    size: PAGE_SIZE,
    active: status === '' ? undefined : status === 'ACTIVE',
    type: type === '' ? undefined : type,
    search: search.trim(),
  })

  function filter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPageIndex(0)
    }
  }

  const columns: ColumnDef<Warehouse, unknown>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: ({ row }) => <span className="font-mono">{row.original.code}</span>,
    },
    { id: 'name', header: 'Name', cell: ({ row }) => row.original.name },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => (row.original.type ? WAREHOUSE_TYPE_LABEL[row.original.type] : ''),
    },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => [row.original.city, row.original.state].filter(Boolean).join(', '),
    },
    { id: 'gstin', header: 'GSTIN', cell: ({ row }) => row.original.gstin ?? '' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <ActiveBadge active={row.original.active} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Warehouses</h1>
        <Button
          disabled={!canWrite}
          title={canWrite ? undefined : 'Needs warehouse.write'}
          onClick={() => setCreating(true)}
        >
          <PlusIcon /> New warehouse
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Input
          placeholder="Search by code, name or city"
          aria-label="Search warehouses"
          value={search}
          onChange={(e) => filter(setSearch)(e.target.value)}
          className="w-64"
        />
        <FilterSelect
          value={status}
          onChange={filter(setStatus)}
          ariaLabel="Status filter"
          allLabel="Active and inactive"
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
        />
        <FilterSelect
          value={type}
          onChange={filter(setType)}
          ariaLabel="Type filter"
          allLabel="All types"
          options={WAREHOUSE_TYPES.map((t) => ({ value: t, label: WAREHOUSE_TYPE_LABEL[t] }))}
        />
      </div>

      {warehouses.isError && <ListError error={warehouses.error} what="Warehouses" />}

      <DataTable
        columns={columns}
        data={warehouses.data?.content ?? []}
        isLoading={warehouses.isLoading}
        emptyMessage="No warehouses match these filters."
        onRowClick={(w) => navigate(`/inventory/warehouses/${w.id}`)}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: warehouses.data?.totalPages ?? 0,
          totalElements: warehouses.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />

      <WarehouseFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(w) => navigate(`/inventory/warehouses/${w.id}`)}
      />
    </div>
  )
}

export default WarehousesPage
