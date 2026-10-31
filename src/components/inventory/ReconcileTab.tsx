import * as React from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ListError } from '@/components/common/PageParts'
import { RefusalText } from '@/components/common/RefusalText'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useRebuildProjectionMutation,
  useReconcileAvailabilityMutation,
  useStockReconcileQuery,
  type AvailabilityReconcileResult,
  type DriftRow,
  type RebuildResult,
} from '@/api/inventory'
import { summariseAvailability } from '@/lib/inventory'
import { toRefusal, type Refusal } from '@/lib/refusal'
import { AVAILABILITY_ACTION_LABEL, labelOf } from '@/lib/labels'

function DriftTable({ rows }: { rows: DriftRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Warehouse</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead className="text-right">Ledger</TableHead>
          <TableHead className="text-right">Projection</TableHead>
          <TableHead className="text-right">Difference</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={`${r.variantId}-${r.warehouseId}-${r.batchId ?? ''}-${i}`}>
            <TableCell className="font-mono">{r.skuCode}</TableCell>
            <TableCell className="font-mono">{r.warehouseCode}</TableCell>
            <TableCell className="font-mono text-xs">{r.batchId?.slice(0, 8) ?? ''}</TableCell>
            <TableCell className="text-right">{r.ledger}</TableCell>
            <TableCell className="text-right">{r.projected}</TableCell>
            <TableCell className="text-right font-medium">{r.difference}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ReconcileTab({ canAdjust }: { canAdjust: boolean }) {
  const reconcile = useStockReconcileQuery()
  const rebuild = useRebuildProjectionMutation()
  const availability = useReconcileAvailabilityMutation()

  const [confirming, setConfirming] = React.useState<'rebuild' | 'availability' | undefined>()
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()
  const [rebuildResult, setRebuildResult] = React.useState<RebuildResult | undefined>()
  const [availabilityResult, setAvailabilityResult] = React.useState<
    AvailabilityReconcileResult | undefined
  >()

  const drift = reconcile.data

  function run() {
    setRefusal(undefined)
    const call =
      confirming === 'rebuild'
        ? rebuild.mutateAsync().then((r) => setRebuildResult(r))
        : availability.mutateAsync().then((r) => setAvailabilityResult(r))
    call
      .then(() => {
        toast.success(
          confirming === 'rebuild' ? 'Projection rebuilt' : 'Availability counters reconciled'
        )
        setConfirming(undefined)
        if (confirming === 'rebuild') {
          void reconcile.refetch()
        }
      })
      .catch((error) => setRefusal(toRefusal(error)))
  }

  const summary = availabilityResult ? summariseAvailability(availabilityResult) : undefined

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Projection against the ledger</CardTitle>
          <CardDescription>
            Compares the stock levels on screen with what the movement ledger adds up to. No drift
            is the expected answer; anything else is an incident.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <Button onClick={() => void reconcile.refetch()} disabled={reconcile.isFetching}>
              {reconcile.isFetching ? 'Checking…' : 'Check for drift'}
            </Button>
          </div>
          {reconcile.isError && <ListError error={reconcile.error} what="The drift check" />}
          {drift && drift.matches && (
            <p role="status" className="text-sm font-medium">
              No drift — the projection matches the ledger.
            </p>
          )}
          {drift && !drift.matches && (
            <div className="flex flex-col gap-2">
              <p role="alert" className="text-sm font-medium text-destructive">
                {drift.driftingLocations} location{drift.driftingLocations === 1 ? '' : 's'}{' '}
                disagree with the ledger.
              </p>
              <DriftTable rows={drift.drifting ?? []} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rebuild projection</CardTitle>
          <CardDescription>
            Throws the stock levels away and recomputes them from the ledger. It locks the
            projection while it runs, so stock movements queue until it finishes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <Button
              variant="outline"
              disabled={!canAdjust}
              title={canAdjust ? undefined : 'Needs inventory.adjust'}
              onClick={() => {
                setRefusal(undefined)
                setConfirming('rebuild')
              }}
            >
              Rebuild projection
            </Button>
          </div>
          {rebuildResult && (
            <div role="status" className="text-sm">
              <p className="font-medium">
                Rebuilt: {rebuildResult.rowsWritten ?? 0} row
                {rebuildResult.rowsWritten === 1 ? '' : 's'} written,{' '}
                {(rebuildResult.corrected ?? []).length} location
                {(rebuildResult.corrected ?? []).length === 1 ? '' : 's'} corrected.
              </p>
              {(rebuildResult.corrected ?? []).length > 0 && (
                <DriftTable rows={rebuildResult.corrected ?? []} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reconcile availability counters</CardTitle>
          <CardDescription>
            Checks every storefront availability counter against Postgres and repairs it. A counter
            that is too high is lowered at once; one that is too low is raised only after it stays
            low past a grace period.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <Button
              variant="outline"
              disabled={!canAdjust}
              title={canAdjust ? undefined : 'Needs inventory.adjust'}
              onClick={() => {
                setRefusal(undefined)
                setConfirming('availability')
              }}
            >
              Reconcile availability counters
            </Button>
          </div>
          {summary && (
            <div role="status" className="flex flex-col gap-2 text-sm">
              <p className="font-medium">
                Checked {summary.checked} variant{summary.checked === 1 ? '' : 's'}:{' '}
                {summary.applied} correction{summary.applied === 1 ? '' : 's'} applied,{' '}
                {summary.deferred} deferred, {summary.inSync} already in sync
                {summary.changedDuringCheck > 0
                  ? `, ${summary.changedDuringCheck} changed during the check`
                  : ''}
                .
              </p>
              {(availabilityResult?.changed ?? []).length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variant</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead className="text-right">Counter before</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Counter after</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(availabilityResult?.changed ?? []).map((r) => (
                      <TableRow key={r.variantId}>
                        <TableCell className="font-mono text-xs" title={r.variantId}>
                          {r.variantId?.slice(0, 8)}…
                        </TableCell>
                        <TableCell>
                          {labelOf(AVAILABILITY_ACTION_LABEL, r.action)}
                        </TableCell>
                        <TableCell className="text-right">{r.counterBefore}</TableCell>
                        <TableCell className="text-right">{r.expected}</TableCell>
                        <TableCell className="text-right">{r.counterAfter}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming === 'rebuild'}
        onOpenChange={(open) => !open && setConfirming(undefined)}
        title="Rebuild the stock projection"
        confirmLabel="Rebuild projection"
        destructive
        pending={rebuild.isPending}
        onConfirm={run}
      >
        <p>
          This deletes every stock level and recomputes it from the movement ledger. It takes an
          exclusive lock on the projection while it runs, so stock movements wait until it is done.
          It can change every number on the stock screens at once.
        </p>
        <RefusalText refusal={refusal} />
      </ConfirmDialog>

      <ConfirmDialog
        open={confirming === 'availability'}
        onOpenChange={(open) => !open && setConfirming(undefined)}
        title="Reconcile availability counters"
        confirmLabel="Reconcile counters"
        pending={availability.isPending}
        onConfirm={run}
      >
        <p>
          This rewrites the storefront&apos;s availability counters from Postgres, the same run the
          service does every minute. It changes what every shopper sees as available. The action is
          audited.
        </p>
        <RefusalText refusal={refusal} />
      </ConfirmDialog>
    </div>
  )
}

export { ReconcileTab }
