import * as React from 'react'
import { Link, useParams } from 'react-router-dom'

import { ActiveBadge } from '@/components/common/ActiveBadge'
import { ActiveToggle } from '@/components/common/ActiveToggle'
import { BackLink, DetailError, Facts } from '@/components/common/PageParts'
import { WarehouseFormDialog } from '@/components/inventory/WarehouseFormDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePermissions } from '@/auth/usePermissions'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { useWarehouseActiveMutation, useWarehouseQuery } from '@/api/inventory'
import { formatDateTime } from '@/lib/orders'
import { WAREHOUSE_TYPE_LABEL } from '@/lib/inventory'

function WarehouseDetailPage() {
  const { id = '' } = useParams()
  const { has } = usePermissions()
  const canWrite = has('warehouse.write')
  const query = useWarehouseQuery(id)
  const toggle = useWarehouseActiveMutation(id)
  const warehouse = query.data
  const [editing, setEditing] = React.useState(false)

  useBreadcrumb([
    { label: 'Inventory' },
    { label: 'Warehouses', to: '/inventory/warehouses' },
    { label: warehouse?.code ?? 'Warehouse' },
  ])

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (query.isError || !warehouse) {
    return (
      <DetailError
        error={query.error}
        noun="warehouse"
        back={{ to: '/inventory/warehouses', label: 'Warehouses' }}
        permission="warehouse.read"
      />
    )
  }

  const address = [
    warehouse.addressLine1,
    warehouse.addressLine2,
    [warehouse.city, warehouse.state].filter(Boolean).join(', '),
    warehouse.pincode,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <BackLink to="/inventory/warehouses" label="Warehouses" />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">
          <span className="font-mono">{warehouse.code}</span> · {warehouse.name}
        </h1>
        <ActiveBadge active={warehouse.active} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            The code is printed on labels and paperwork and cannot be changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Facts
            rows={[
              ['Code', <span className="font-mono">{warehouse.code}</span>],
              ['Name', warehouse.name],
              ['Type', warehouse.type ? WAREHOUSE_TYPE_LABEL[warehouse.type] : ''],
              ['GSTIN', warehouse.gstin],
              ['Address', address],
              ['Created', formatDateTime(warehouse.createdAt)],
              ['Last changed', formatDateTime(warehouse.updatedAt)],
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={!canWrite}
              title={canWrite ? undefined : 'Needs warehouse.write'}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            <ActiveToggle
              noun="warehouse"
              name={warehouse.name ?? 'This warehouse'}
              active={warehouse.active !== false}
              allowed={canWrite}
              permission="warehouse.write"
              deactivateWarning="A deactivated warehouse can no longer receive or send stock. The server refuses while it still holds stock, and says how many units."
              onToggle={(action) => toggle.mutateAsync(action)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock here</CardTitle>
          <CardDescription>
            What this warehouse holds, and what has moved through it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Link className="underline" to={`/inventory/stock?tab=levels&warehouse=${warehouse.id}`}>
            Stock levels in this warehouse
          </Link>
          <Link
            className="underline"
            to={`/inventory/stock?tab=movements&warehouse=${warehouse.id}`}
          >
            Movements in this warehouse
          </Link>
        </CardContent>
      </Card>

      <WarehouseFormDialog open={editing} onOpenChange={setEditing} warehouse={warehouse} />
    </div>
  )
}

export default WarehouseDetailPage
