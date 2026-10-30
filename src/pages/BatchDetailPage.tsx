import * as React from 'react'
import { Link, useParams } from 'react-router-dom'

import { BackLink, DetailError, Facts } from '@/components/common/PageParts'
import { MovementsTable } from '@/components/inventory/MovementsTable'
import { TransferDrawer } from '@/components/inventory/TransferDrawer'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { useBatchQuery, useStockMovementsQuery } from '@/api/inventory'
import { formatDate } from '@/lib/inventory'
import { formatDateTime } from '@/lib/orders'

function BatchDetailPage() {
  const { id = '' } = useParams()
  const query = useBatchQuery(id)
  const batch = query.data
  const movements = useStockMovementsQuery({ page: 0, size: 20, batchId: id })
  const [transferId, setTransferId] = React.useState<string | undefined>()

  useBreadcrumb([
    { label: 'Inventory' },
    { label: 'Batches', to: '/inventory/batches' },
    { label: batch?.batchNumber ?? 'Batch' },
  ])

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (query.isError || !batch) {
    return (
      <DetailError
        error={query.error}
        noun="batch"
        back={{ to: '/inventory/batches', label: 'Batches' }}
        permission="inventory.read"
      />
    )
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <BackLink to="/inventory/batches" label="Batches" />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{batch.batchNumber}</h1>
        {batch.expired && <Badge variant="destructive">Expired</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            A batch is read-only once created. An expired batch can only be reduced: damage, expiry
            write-off or a negative adjustment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Facts
            rows={[
              ['Batch number', <span className="font-mono">{batch.batchNumber}</span>],
              ['Variant', <span className="font-mono text-xs">{batch.variantId}</span>],
              ['Manufactured', formatDate(batch.manufacturedOn)],
              [
                'Expires',
                batch.expiresOn
                  ? `${formatDate(batch.expiresOn)} (good through that day)`
                  : 'No expiry',
              ],
              ['Expires at', formatDateTime(batch.expiresAt)],
              ['Created', formatDateTime(batch.createdAt)],
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movements</CardTitle>
          <CardDescription>
            The latest twenty against this batch.{' '}
            <Link className="underline" to={`/inventory/stock?tab=movements&batch=${batch.id}`}>
              Open in the ledger
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MovementsTable
            rows={movements.data?.content ?? []}
            isLoading={movements.isLoading}
            emptyMessage="Nothing has moved against this batch yet."
            onOpenTransfer={setTransferId}
          />
        </CardContent>
      </Card>

      <TransferDrawer referenceId={transferId} onClose={() => setTransferId(undefined)} />
    </div>
  )
}

export default BatchDetailPage
