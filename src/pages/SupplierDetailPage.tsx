import * as React from 'react'
import { Link, useParams } from 'react-router-dom'

import { ActiveBadge } from '@/components/common/ActiveBadge'
import { ActiveToggle } from '@/components/common/ActiveToggle'
import { BackLink, DetailError, Facts } from '@/components/common/PageParts'
import { SupplierFormDialog } from '@/components/procurement/SupplierFormDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePermissions } from '@/auth/usePermissions'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { useSupplierActiveMutation, useSupplierQuery } from '@/api/procurement'
import { formatDateTime } from '@/lib/orders'

function SupplierDetailPage() {
  const { id = '' } = useParams()
  const { has } = usePermissions()
  const canWrite = has('procurement.supplier.write')
  const query = useSupplierQuery(id)
  const toggle = useSupplierActiveMutation(id)
  const supplier = query.data
  const [editing, setEditing] = React.useState(false)

  useBreadcrumb([
    { label: 'Procurement' },
    { label: 'Suppliers', to: '/procurement/suppliers' },
    { label: supplier?.code ?? 'Supplier' },
  ])

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (query.isError || !supplier) {
    return (
      <DetailError
        error={query.error}
        noun="supplier"
        back={{ to: '/procurement/suppliers', label: 'Suppliers' }}
        permission="procurement.supplier.read"
      />
    )
  }

  const address = [
    supplier.addressLine1,
    supplier.addressLine2,
    [supplier.city, supplier.state].filter(Boolean).join(', '),
    supplier.pincode,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <BackLink to="/procurement/suppliers" label="Suppliers" />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">
          <span className="font-mono">{supplier.code}</span> · {supplier.name}
        </h1>
        <ActiveBadge active={supplier.active} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            The code appears on purchase orders that outlive the relationship and cannot be changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Facts
            rows={[
              ['Code', <span className="font-mono">{supplier.code}</span>],
              ['Name', supplier.name],
              ['GSTIN', supplier.gstin],
              ['Payment terms', `${supplier.paymentTermsDays ?? 0} days`],
              ['Address', address],
              ['Contact', supplier.contactName],
              ['Phone', supplier.contactPhone],
              ['Email', supplier.contactEmail],
              ['Created', formatDateTime(supplier.createdAt)],
              ['Last changed', formatDateTime(supplier.updatedAt)],
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={!canWrite}
              title={canWrite ? undefined : 'Needs procurement.supplier.write'}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            <ActiveToggle
              noun="supplier"
              name={supplier.name ?? 'This supplier'}
              active={supplier.active !== false}
              allowed={canWrite}
              permission="procurement.supplier.write"
              deactivateWarning="A deactivated supplier disappears from every picker. The server refuses while any purchase order against them is still open (draft, approved or partially received), and names the first few."
              onToggle={(action) => toggle.mutateAsync(action)}
            />
          </div>
        </CardContent>
      </Card>

      {has('procurement.po.read') && (
        <Card>
          <CardHeader>
            <CardTitle>Purchase orders</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link className="underline" to={`/procurement/purchase-orders?supplier=${supplier.id}`}>
              Purchase orders raised to this supplier
            </Link>
          </CardContent>
        </Card>
      )}

      <SupplierFormDialog open={editing} onOpenChange={setEditing} supplier={supplier} />
    </div>
  )
}

export default SupplierDetailPage
