import * as React from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'

import type { OrderDetail, OrderPayment } from '@/api/orders'
import { usePermissions } from '@/auth/usePermissions'
import { ManualRefundDialog } from '@/components/orders/ManualRefundDialog'
import { RefundSettlementDialog } from '@/components/orders/RefundSettlementDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/dates'
import {
  GATEWAY_STATUS_LABEL,
  labelOf,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
} from '@/lib/labels'
import {
  canRecordRefund,
  isManualPayment,
  REFUND_SETTLEMENT_PERMISSION,
  refundGate,
  rupees,
} from '@/lib/orders'

function Copyable({ value }: { value: string | undefined }) {
  const [copied, setCopied] = React.useState(false)
  if (!value) {
    return <>{'—'}</>
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-xs break-all">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label={`Copy ${value}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            },
            () => undefined
          )
        }}
      >
        {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
      </Button>
    </span>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{children || '—'}</dd>
    </div>
  )
}

/**
 * Payment as OMS holds it beside payment as the gateway last reported it (D9.7), so "captured in
 * OMS but not at the gateway" is visible at a glance.
 */
function OrderPaymentCard({ order, onStale }: { order: OrderDetail; onStale?: () => void }) {
  const { has } = usePermissions()
  const [recording, setRecording] = React.useState(false)
  const [refundingExcess, setRefundingExcess] = React.useState<OrderPayment | undefined>()
  const p = order.payment
  const manual = isManualPayment(p)
  const stale = onStale ?? (() => undefined)
  const gate = refundGate(order)
  const excess = order.excessPayments ?? []
  const mayRefund = has(REFUND_SETTLEMENT_PERMISSION)
  const inFlight = (order.refunds ?? []).some(
    (r) => r.outcome === 'REQUESTED' || r.outcome === 'INITIATED'
  )
  const mismatch = p?.status === 'CAPTURED' && !!p.gatewayStatus && p.gatewayStatus !== 'CAPTURED'
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Fact label="Payment status">
            <Badge variant={p?.status === 'CAPTURED' ? 'default' : 'outline'}>
              {labelOf(PAYMENT_STATUS_LABEL, p?.status)}
            </Badge>
          </Fact>
          <Fact label="Gateway status">
            {p?.gatewayStatus ? (
              <span>
                <Badge variant={mismatch ? 'destructive' : 'outline'}>
                  {labelOf(GATEWAY_STATUS_LABEL, p.gatewayStatus)}
                </Badge>
                {p.gatewayStatusAt && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    as of {formatDateTime(p.gatewayStatusAt)}
                  </span>
                )}
              </span>
            ) : undefined}
          </Fact>
          <Fact label="Method">
            {labelOf(PAYMENT_METHOD_LABEL, p?.method ?? order.paymentMethod)}
          </Fact>
          <Fact label="Amount">{rupees(p?.amountMinor)}</Fact>
          <Fact label="Gateway">{manual ? 'Recorded by the team (no gateway)' : p?.gateway}</Fact>
          <Fact label="Captured">{formatDateTime(p?.capturedAt)}</Fact>
          {manual ? (
            <>
              <Fact label="Payment reference">
                <Copyable value={p?.manualReference ?? undefined} />
              </Fact>
              <Fact label="Received at">{formatDateTime(p?.receivedAt)}</Fact>
              <Fact label="Recorded by">
                {p?.recordedByName ?? p?.recordedBy}
                {p?.recordedAt ? ` · ${formatDateTime(p.recordedAt)}` : ''}
              </Fact>
              <Fact label="Note">{p?.manualNote}</Fact>
            </>
          ) : (
            <>
              <Fact label="Gateway order id">
                <Copyable value={p?.gatewayOrderId} />
              </Fact>
              <Fact label="Gateway payment id">
                <Copyable value={p?.gatewayPaymentId} />
              </Fact>
            </>
          )}
          <Fact label="Invoice">
            {order.invoice ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-mono">{order.invoice.number}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  issued {formatDateTime(order.invoice.issuedAt)}
                </span>
              </span>
            ) : undefined}
          </Fact>
        </dl>
        {mismatch && (
          <p role="status" className="text-sm text-destructive">
            OMS has this payment as captured, but Razorpay last reported it as{' '}
            {labelOf(GATEWAY_STATUS_LABEL, p?.gatewayStatus ?? undefined).toLowerCase()}.
          </p>
        )}
        {p?.status === 'VOIDED' && (
          <p className="text-sm">
            {p.voidReason ?? 'The payment was never captured, so nothing was charged.'}
            {p.voidedAt ? ` (${formatDateTime(p.voidedAt)})` : ''}
          </p>
        )}
        {p?.lastCaptureError && (
          <p role="alert" className="text-sm text-destructive">
            Last capture error: {p.lastCaptureError}
          </p>
        )}
        {!order.invoice && (
          <p className="text-xs text-muted-foreground">
            The invoice is numbered when the order is confirmed.
          </p>
        )}
        {manual && (
          <p className="text-xs text-muted-foreground">
            Paid without a gateway payment: any refund is paid outside Razorpay and recorded here.
          </p>
        )}
        {manual && canRecordRefund(order) && !gate.visible && (
          <div>
            <Button
              variant="outline"
              disabled={!mayRefund}
              title={mayRefund ? undefined : `Needs ${REFUND_SETTLEMENT_PERMISSION}`}
              onClick={() => setRecording(true)}
            >
              Record refund
            </Button>
          </div>
        )}
        {excess.length > 0 && (
          <div className="flex flex-col gap-3" data-testid="excess-payments">
            <h3 className="text-sm font-medium">Excess payments</h3>
            {excess.map((x) => {
              const owed = x.status === 'REFUND_PENDING'
              const blocked = !mayRefund || inFlight
              return (
                <div
                  key={x.id}
                  className="flex flex-col gap-2 rounded-md border border-destructive/40 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="destructive">
                      Excess —{' '}
                      {owed ? 'refund owed' : labelOf(PAYMENT_STATUS_LABEL, x.status).toLowerCase()}
                    </Badge>
                    <span className="font-medium">{rupees(x.amountMinor)}</span>
                    <span className="text-xs text-muted-foreground">
                      {labelOf(PAYMENT_METHOD_LABEL, x.method)} · {formatDateTime(x.capturedAt)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    A link was paid after the order was already paid. Gateway payment id:{' '}
                    <Copyable value={x.gatewayPaymentId} />
                  </div>
                  {owed && (
                    <div>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={blocked}
                        title={
                          !mayRefund
                            ? `Needs ${REFUND_SETTLEMENT_PERMISSION}`
                            : inFlight
                              ? gate.settleReason
                              : undefined
                        }
                        onClick={() => setRefundingExcess(x)}
                      >
                        Refund via Razorpay
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
      {recording && (
        <ManualRefundDialog order={order} onClose={() => setRecording(false)} onStale={stale} />
      )}
      {refundingExcess && (
        <RefundSettlementDialog
          order={order}
          kind="gateway"
          amountMinor={refundingExcess.amountMinor}
          onClose={() => setRefundingExcess(undefined)}
          onStale={stale}
        />
      )}
    </Card>
  )
}

export { OrderPaymentCard }
