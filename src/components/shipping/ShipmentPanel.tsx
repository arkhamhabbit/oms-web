import * as React from 'react'
import { Link } from 'react-router-dom'
import { CopyIcon, ScrollTextIcon } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { noticeFromError } from '@/components/common/NoticeBanner'
import { BookingAttemptsDrawer, ShipmentLogDrawer } from '@/components/shipping/ShippingCallDrawer'
import { ShipmentStateChip, ShipmentStatusChip } from '@/components/shipping/ShipmentStateChip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { OrderDetail } from '@/api/orders'
import { useWarehouseQuery } from '@/api/inventory'
import {
  useCancelShipmentMutation,
  useRefreshShipmentMutation,
  useShipmentQuery,
  type ShipmentDetail,
} from '@/api/shipping'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError, isVersionConflict } from '@/lib/api-error'
import { formatDateTime } from '@/lib/dates'
import { trackingUrl } from '@/lib/orders'
import {
  box,
  grams,
  isCourierProvider,
  providerLabel,
  SHIPMENT_STATUS_LABEL,
  trackingEventTitle,
} from '@/lib/shipping'

const DASH = '—'

/** Where a tracking event came from. SYSTEM is OMS with no team member (a cancel after the shopper's own). */
const EVENT_SOURCE_LABEL = {
  POLL: 'polled',
  WEBHOOK: 'webhook',
  ADMIN: 'by hand',
  SYSTEM: 'System',
} as const

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium break-words">{value || DASH}</dd>
        </div>
      ))}
    </dl>
  )
}

function CopyButton({ text, what }: { text: string; what: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6"
      aria-label={`Copy ${what}`}
      onClick={() =>
        void navigator.clipboard
          ?.writeText(text)
          .then(() => toast.success(`${what} copied`))
          .catch(() => toast.error(`${what} could not be copied`))
      }
    >
      <CopyIcon className="size-3.5" />
    </Button>
  )
}

/**
 * The order's shipment (2.8): where it stands, who carries it, what was booked, the actions, the
 * provider's timeline and the shipments before it. Tracking, label and cancel always go to the
 * provider that booked the shipment, never to the current default (D13.4).
 */
function ShipmentPanel({
  order,
  onBook,
  onPrint,
  printing,
}: {
  order: OrderDetail
  onBook: () => void
  onPrint: (shipmentId: string) => void
  printing: boolean
}) {
  const { has } = usePermissions()
  const canRead = has('shipping.read')
  const canBook = has('shipping.book')
  const live = order.shipment ?? undefined
  const previous = (order.shipments ?? []).filter((s) => s.id !== live?.id)
  const detailQuery = useShipmentQuery(live?.id, canRead)
  const detail = detailQuery.data
  const warehouseId = live?.pickupWarehouseId ?? ''
  const warehouse = useWarehouseQuery(warehouseId, !!warehouseId && has('warehouse.read'))
  const [logOpen, setLogOpen] = React.useState(false)
  const [attemptsOpen, setAttemptsOpen] = React.useState(false)
  const [previousOpen, setPreviousOpen] = React.useState(false)
  const attempts = order.shippingCalls ?? []
  const failedAttempts = attempts.filter((c) => !c.success).length
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [refusal, setRefusal] = React.useState<string | undefined>()

  const refresh = useRefreshShipmentMutation(live?.id ?? '')
  const courier = isCourierProvider(live?.providerCode)
  const bookable = order.status === 'CONFIRMED' && !live
  const awb = live?.awb ?? undefined
  const link = live?.trackingUrl ?? trackingUrl(live?.courierName ?? undefined, awb)
  const needs = (perm: string) => (has(perm) ? undefined : `Needs ${perm}`)

  function doRefresh() {
    setRefusal(undefined)
    refresh
      .mutateAsync(crypto.randomUUID())
      .then(() => toast.success('Tracking refreshed'))
      .catch((error) => setRefusal(noticeFromError(error, 'This shipment').text))
  }

  const legacy = !live && previous.length === 0 && (order.carrier || order.trackingReference)

  return (
    <Card id="shipment">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Shipment</CardTitle>
          <ShipmentStateChip state={order.shipmentState} />
          {live && canRead && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setLogOpen(true)}>
              <ScrollTextIcon /> Log
            </Button>
          )}
        </div>
        <CardDescription>
          {live
            ? courier
              ? 'The courier is the authority on where the parcel is: its events move the order.'
              : 'A Manual shipment: the team moves it by hand with Ship, Out for delivery and Deliver.'
            : 'Not booked. Booking makes the order Packed (booked, ready for pickup).'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {order.bookingFailure && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <span className="font-medium">Booking failed: </span>
            {order.bookingFailure}
          </p>
        )}

        {live && (
          <Facts
            rows={[
              ['Status', SHIPMENT_STATUS_LABEL[live.status as keyof typeof SHIPMENT_STATUS_LABEL] ?? live.status],
              ['Provider', providerLabel(live.providerCode)],
              ['Courier', live.courierName],
              [
                'AWB',
                awb ? (
                  <span className="inline-flex items-center gap-1">
                    {link ? (
                      <a href={link} target="_blank" rel="noreferrer" className="font-mono underline underline-offset-2">
                        {awb}
                      </a>
                    ) : (
                      <span className="font-mono">{awb}</span>
                    )}
                    <CopyButton text={awb} what="AWB" />
                  </span>
                ) : undefined,
              ],
              [
                'Pickup warehouse',
                warehouse.data ? (
                  <Link className="underline underline-offset-2" to={`/inventory/warehouses/${warehouse.data.id}`}>
                    {warehouse.data.name} ({warehouse.data.code})
                  </Link>
                ) : (
                  <span className="font-mono text-xs">{live.pickupWarehouseId}</span>
                ),
              ],
              [
                'Booked package',
                detail ? `${grams(detail.weightGrams)}, ${box(detail.lengthMm, detail.widthMm, detail.heightMm)}` : undefined,
              ],
              [
                'Booked',
                [formatDateTime(live.bookedAt), detail?.bookedBy?.displayName].filter(Boolean).join(' · '),
              ],
              ...(detail?.cancelledBy
                ? ([
                    [
                      'Cancelled',
                      [formatDateTime(live.cancelledAt), detail.cancelledBy.displayName]
                        .filter(Boolean)
                        .join(' · '),
                    ],
                  ] as [string, React.ReactNode][])
                : []),
              ['Label printed', live.labelPrintedAt ? formatDateTime(live.labelPrintedAt) : 'Not yet'],
              ['Expected delivery', live.expectedDeliveryAt ? formatDateTime(live.expectedDeliveryAt) : undefined],
              ['Last problem', live.lastError],
            ]}
          />
        )}

        {legacy && (
          <Facts
            rows={[
              ['Carrier (before 2.8)', order.carrier],
              ['Tracking reference', order.trackingReference],
            ]}
          />
        )}

        <div className="flex flex-wrap gap-2">
          {bookable && (
            <Button size="sm" disabled={!canBook} title={needs('shipping.book')} onClick={onBook}>
              Book shipment
            </Button>
          )}
          {live && (
            <>
              <Button
                size="sm"
                variant={courier && !live.labelPrintedAt ? 'default' : 'outline'}
                disabled={!canBook || printing}
                title={needs('shipping.book')}
                onClick={() => onPrint(live.id!)}
              >
                Print label
              </Button>
              {courier && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canBook || refresh.isPending}
                  title={needs('shipping.book')}
                  onClick={doRefresh}
                >
                  Refresh tracking
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={!canBook || !detail}
                title={needs('shipping.book') ?? (detail ? undefined : 'Needs shipping.read')}
                onClick={() => {
                  setRefusal(undefined)
                  setCancelOpen(true)
                }}
              >
                Cancel shipment
              </Button>
            </>
          )}
          {!canBook && (bookable || live) && (
            <span className="self-center text-xs text-muted-foreground">Needs shipping.book</span>
          )}
        </div>
        {refusal && (
          <p role="alert" className="text-sm text-destructive">
            {refusal}
          </p>
        )}

        {live && canRead && <Timeline detail={detail} loading={detailQuery.isLoading} error={detailQuery.error} />}

        {canRead && attempts.length > 0 && (
          <section aria-label="Booking attempts" className="flex flex-wrap items-center gap-2 text-sm">
            <h3 className="font-medium">Booking attempts</h3>
            <span className="text-muted-foreground">
              {attempts.length} {attempts.length === 1 ? 'call' : 'calls'}, {failedAttempts} failed
            </span>
            <Button variant="ghost" size="sm" onClick={() => setAttemptsOpen(true)}>
              <ScrollTextIcon /> Open
            </Button>
          </section>
        )}

        {previous.length > 0 && (
          <details className="text-sm" onToggle={(e) => setPreviousOpen(e.currentTarget.open)}>
            <summary className="cursor-pointer font-medium">
              Previous shipments ({previous.length})
            </summary>
            <Table aria-label="Previous shipments" className="mt-2 [&_td]:px-2 [&_th]:px-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Booked</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>AWB</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cancelled</TableHead>
                  <TableHead>Cancelled by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previous.map((s) => (
                  <PreviousShipmentRow key={s.id} shipment={s} read={previousOpen && canRead} />
                ))}
              </TableBody>
            </Table>
          </details>
        )}
      </CardContent>

      {canRead && (
        <BookingAttemptsDrawer
          open={attemptsOpen}
          calls={attempts}
          onClose={() => setAttemptsOpen(false)}
        />
      )}
      {live && (
        <ShipmentLogDrawer
          open={logOpen}
          calls={detail?.calls ?? []}
          awb={awb}
          onClose={() => setLogOpen(false)}
        />
      )}
      {live && detail && cancelOpen && (
        <CancelShipmentDialog
          detail={detail}
          courier={courier}
          onClose={() => setCancelOpen(false)}
          onStale={() => void detailQuery.refetch()}
        />
      )}
    </Card>
  )
}

/**
 * One earlier shipment. Who cancelled it is on the shipment's own record, read once the list is
 * opened (and only for a member who can read shipments).
 */
function PreviousShipmentRow({
  shipment,
  read,
}: {
  shipment: NonNullable<OrderDetail['shipments']>[number]
  read: boolean
}) {
  const detail = useShipmentQuery(shipment.id, read && !!shipment.cancelledAt)
  return (
    <TableRow>
      <TableCell>{formatDateTime(shipment.bookedAt)}</TableCell>
      <TableCell>{providerLabel(shipment.providerCode)}</TableCell>
      <TableCell>{shipment.courierName ?? DASH}</TableCell>
      <TableCell className="font-mono">{shipment.awb ?? DASH}</TableCell>
      <TableCell>
        <ShipmentStatusChip status={shipment.status as never} />
      </TableCell>
      <TableCell>{shipment.cancelledAt ? formatDateTime(shipment.cancelledAt) : DASH}</TableCell>
      <TableCell>{detail.data?.cancelledBy?.displayName ?? DASH}</TableCell>
    </TableRow>
  )
}

/** The provider's status history, newest first, in the feed's style. */
function Timeline({
  detail,
  loading,
  error,
}: {
  detail: ShipmentDetail | undefined
  loading: boolean
  error: unknown
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading the tracking timeline…</p>
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {isApiError(error) ? error.message : 'The tracking timeline could not be loaded.'}
      </p>
    )
  }
  const events = [...(detail?.events ?? [])].reverse()
  return (
    <section aria-label="Tracking timeline" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Tracking timeline</h3>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tracking events yet.</p>
      ) : (
        <ol aria-label="Tracking events" className="flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-md px-3 py-2 text-sm text-muted-foreground">
              <div className="text-foreground">
                {trackingEventTitle(e) ??
                  (e.status ? SHIPMENT_STATUS_LABEL[e.status] : (e.providerStatusText ?? e.providerStatusCode))}
                {e.location && ` · ${e.location}`}
              </div>
              <div className="text-xs">
                {formatDateTime(e.eventAt)}
                {` · ${EVENT_SOURCE_LABEL[e.source ?? 'POLL']}`}
                {e.providerStatusCode && ` · code ${e.providerStatusCode}`}
                {e.providerStatusText && e.status && ` (${e.providerStatusText})`}
                {e.remark && ` · ${e.remark}`}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function CancelShipmentDialog({
  detail,
  courier,
  onClose,
  onStale,
}: {
  detail: ShipmentDetail
  courier: boolean
  onClose: () => void
  onStale: () => void
}) {
  const shipment = detail.shipment!
  const cancel = useCancelShipmentMutation(shipment.id!)
  const [reason, setReason] = React.useState('')
  const [key, setKey] = React.useState(() => crypto.randomUUID())
  const [refusal, setRefusal] = React.useState<string | undefined>()

  function confirm() {
    setRefusal(undefined)
    cancel
      .mutateAsync({ version: shipment.version!, reason: reason.trim(), idempotencyKey: key })
      .then(() => {
        toast.success('Shipment cancelled')
        onClose()
      })
      .catch((error) => {
        setRefusal(noticeFromError(error, 'This shipment').text)
        if (isApiError(error) && error.code !== 'NETWORK_ERROR') {
          setKey(crypto.randomUUID())
        }
        if (isVersionConflict(error)) {
          onStale()
        }
      })
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Cancel shipment"
      confirmLabel="Cancel shipment"
      destructive
      pending={cancel.isPending}
      onConfirm={confirm}
    >
      <p>
        {courier
          ? `${providerLabel(shipment.providerCode)} is asked to cancel ${shipment.awb ?? 'this shipment'}. It refuses once the courier has the parcel.`
          : `The Manual shipment ${shipment.awb ?? ''} is cancelled.`}{' '}
        The order goes back to Confirmed, ready to book again.
      </p>
      <div className="grid gap-1.5 text-foreground">
        <Label htmlFor="shipment-cancel-reason">Reason (optional)</Label>
        <Input
          id="shipment-cancel-reason"
          maxLength={300}
          placeholder="Kept on the shipment and the order's history"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {refusal && (
        <p role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      )}
    </ConfirmDialog>
  )
}

export { ShipmentPanel }
