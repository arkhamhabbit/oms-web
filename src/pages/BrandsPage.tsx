import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/data-table/DataTable'
import { Badge } from '@/components/ui/badge'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { brandsFixture, type Brand } from '@/fixtures/brands'

function statusVariant(status: Brand['status']) {
  switch (status) {
    case 'ACTIVE':
      return 'default' as const
    case 'IN_REVIEW':
      return 'secondary' as const
    default:
      return 'outline' as const
  }
}

const columns: ColumnDef<Brand, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'slug', header: 'Slug' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge>,
  },
  {
    accessorKey: 'live',
    header: 'Live',
    cell: ({ row }) => (row.original.live ? <Badge variant="secondary">LIVE</Badge> : null),
  },
  { accessorKey: 'productCount', header: 'Products' },
]

function BrandsPage() {
  useBreadcrumb([{ label: 'Brands' }])
  const data = useMemo(() => brandsFixture, [])

  return <DataTable columns={columns} data={data} pageSize={5} />
}

export default BrandsPage
