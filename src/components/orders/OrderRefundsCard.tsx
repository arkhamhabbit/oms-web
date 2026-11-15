import * as React from 'react'
import { toast } from 'sonner'

import { usePermissions } from '@/auth/usePermissions'
import { useRefreshRefundMutation, type OrderDetail, type OrderRefund } from '@/api/orders'
import { noticeFromError } from '@/components/common/NoticeBanner'
import {
  RefundSettlementDialog,
  type RefundSettlementKind,
} from '@/components/orders/RefundSettlementDialog'
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
import { isVersionConflict } from '@/lib/api-error'
import { formatDateTime } from '@/lib/dates'
import {
  labelOf,
  REFUND_METHOD_LABEL,
  REFUND_OUTCOME_LABEL,
  REFUND_REQUESTER_LABEL,
} from '@/lib/labels'
import { REFUND_SETTLEMENT_PERMISSION, refundGate, rupees } from '@/lib/orders'
import { cn } from '@/lib/utils'

/** The one line that says where the money stands (D9.8): owed, in flight, paid back, or never charged. */
export function refundHeadline(order: OrderDetail): string | undefined {
  switch (order.refundState) {
    case 'OWED':
      return `Refund owed ${rupees(order.payment?.amountMinor)}`
    case 'INITIATED':
      return 'Refund initiated — waiting for Razorpay'
    case 'REFUNDED':
      return 'Refunded'
    case 'VOIDED':
      return 'Voided — never captured, nothing charged'
    default:
      return undefined
  }
}

const EARLIER = 'recorded from earlier history'

function RefundHistory({ rows }: { rows: OrderRefund[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No refund has been attempted yet.</p>
  }
  return (
    <Table aria-label="Refund history" className="text-xs [&_td]:px-2 [&_td]:whitespace-normal [&_th]:px-2">
      <TableHeader>
        <TableRow>
          <TableHead>When / who</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Refund id / reference</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="whitespace-nowrap">{formatDateTime(row.requestedAt)}</div>
              <div className="text-xs text-muted-foreground">
                {row.requestedByName ?? (row.backfilled ? EARLIER : '—')}
              </div>
            </TableCell>
            <TableCell>{labelOf(REFUND_METHOD_LABEL, row.method)}</TableCell>
            <TableCell className="text-right">{rupees(row.amountMinor)}</TableCell>
            <TableCell className="font-mono text-xs break-all">
              {row.gatewayRefundId ?? row.reference ?? '—'}
              {row.reason && <div className="font-sans text-muted-foreground">{row.reason}</div>}
            </TableCell>
            <TableCell>
              <div className="font-medium">{labelOf(REFUND_OUTCOME_LABEL, row.outcome)}</div>
              {row.backfilled && row.requestedByName && (
                <div className="text-xs text-muted-foreground">{EARLIER}</div>
              )}
              {row.gatewayStatus && (
                <div className="text-xs text-muted-foreground">Gateway: {row.gatewayStatus}</div>
              )}
              {row.failureSentence && (
                <div className="text-xs text-destructive">{row.failureSentence}</div>
              )}
              {row.processedAt && (
                <div className="text-xs text-muted-foreground">
                  Processed {formatDateTime(row.processedAt)}
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * D9.8 — the refund controls and their full history, shown whenever the order's refund state is
 * not NONE. Two rules are not negotiable: the Razorpay confirm names the exact amount and says
 * the gateway is called once; and while a refund row is still REQUESTED (the gateway never
 * answered) both actions are off and only Refresh is offered, because a second press could
 * refund twice.
 */
function OrderRefundsCard({ order, onStale }: { order: OrderDetail; onStale: () => void }) {
  const { has } = usePermissions()
  const refresh = useRefreshRefundMutation(order.id!)
  const [kind, setKind] = React.useState<RefundSettlementKind | undefined>()
  const [refusal, setRefusal] = React.useState<string | undefined>()
  const gate = refundGate(order)
  if (!gate.visible) {
    return null
  }
  const allowed = has(REFUND_SETTLEMENT_PERMISSION)
  const needs = `Needs ${REFUND_SETTLEMENT_PERMISSION}`
  const owed = order.refundState === 'OWED'
  const showSettle = order.refundState !== 'VOIDED'

  function doRefresh() {
    setRefusal(undefined)
    refresh
      .mutateAsync({ version: order.version!, idempotencyKey: crypto.randomUUID() })
      .then(() => toast.success('Refund status refreshed'))
      .catch((error) => {
        setRefusal(noticeFromError(error, 'This order').text)
        if (isVersionConflict(error)) {
          onStale()
        }
      })
  }

  const decidedBy = order.payment?.refundRequestedByKind
    ? (order.payment.refundRequestedBy ??
      labelOf(REFUND_REQUESTER_LABEL, order.payment.refundRequestedByKind))
    : undefined

  return (
    <Card id="refunds" className={cn(owed && 'border-destructive/40')}>
      <CardHeader>
        <CardTitle>Refunds</CardTitle>
        <CardDescription>
          A person decides every refund; OMS records each attempt and keeps it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p
          data-testid="refund-headline"
          className={cn('text-base font-semibold', owed && 'text-destructive')}
        >
          {refundHeadline(order)}
        </p>
        {decidedBy && (
          <p className="-mt-2 text-xs text-muted-foreground">
            Refund decided by {decidedBy}
            {order.payment?.refundReason ? ` · ${order.payment.refundReason}` : ''}
          </p>
        )}

        {gate.lostAnswerSentence && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
          >
            {gate.lostAnswerSentence}
          </p>
        )}
        {order.refundState === 'VOIDED' && order.payment?.voidReason && (
          <p className="text-sm text-muted-foreground">{order.payment.voidReason}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {showSettle && (
            <>
              <Button
                disabled={!allowed || !gate.canGateway}
                title={!allowed ? needs : gate.gatewayReason}
                onClick={() => setKind('gateway')}
              >
                Refund via Razorpay
              </Button>
              <Button
                variant="outline"
                disabled={!allowed || !gate.canSettle}
                title={!allowed ? needs : gate.settleReason}
                onClick={() => setKind('mark-refunded')}
              >
                Mark as refunded
              </Button>
            </>
          )}
          {gate.canRefresh && (
            <Button
              variant={gate.lostAnswer ? 'default' : 'outline'}
              disabled={!allowed || refresh.isPending}
              title={allowed ? undefined : needs}
              onClick={doRefresh}
            >
              Refresh status
            </Button>
          )}
        </div>
        {showSettle && allowed && gate.gatewayReason && !gate.lostAnswerSentence && (
          <p data-testid="refund-disabled-reason" className="-mt-2 text-xs text-muted-foreground">
            {gate.gatewayReason}
          </p>
        )}
        {refusal && (
          <p role="alert" className="text-sm text-destructive">
            {refusal}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Refund history</h3>
          <RefundHistory rows={order.refunds ?? []} />
        </div>
      </CardContent>
      <RefundSettlementDialog
        order={order}
        kind={kind}
        onClose={() => setKind(undefined)}
        onStale={onStale}
      />
    </Card>
  )
}

export { OrderRefundsCard }
