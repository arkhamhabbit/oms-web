import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, CopyIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useShippingCallQuery, type ShippingCallSummary } from '@/api/shipping'
import { isApiError } from '@/lib/api-error'
import { formatDateTime } from '@/lib/dates'
import { CALL_ACTION_LABEL, prettyBody, providerLabel } from '@/lib/shipping'

const DRAWER =
  'fixed top-0 right-0 left-auto h-svh max-h-svh w-full translate-x-0 translate-y-0 content-start gap-4 overflow-y-auto rounded-none sm:max-w-2xl'

function SuccessChip({ success }: { success: boolean | undefined }) {
  return success ? (
    <Badge variant="secondary">Success</Badge>
  ) : (
    <Badge variant="destructive">Failed</Badge>
  )
}

function copy(text: string, what: string) {
  void navigator.clipboard
    ?.writeText(text)
    .then(() => toast.success(`${what} copied`))
    .catch(() => toast.error(`${what} could not be copied`))
}

function BodyBlock({ title, body }: { title: string; body: string | null | undefined }) {
  const pretty = prettyBody(body)
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {pretty && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Copy ${title.toLowerCase()}`}
            onClick={() => copy(pretty, title)}
          >
            <CopyIcon /> Copy
          </Button>
        )}
      </div>
      {pretty ? (
        <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs break-all whitespace-pre-wrap">
          {pretty}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">
          {title === 'Request' ? 'Nothing was sent with it.' : 'No response body was kept.'}
        </p>
      )}
    </section>
  )
}

/** One exchange, whole: the facts and both bodies (credentials already masked by the server, D13.9). */
function CallDetail({ id }: { id: string }) {
  const query = useShippingCallQuery(id)
  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (query.isError || !query.data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {isApiError(query.error) ? query.error.message : 'This call could not be loaded.'}
      </p>
    )
  }
  const c = query.data.call ?? {}
  const rows: [string, React.ReactNode][] = [
    ['When', formatDateTime(c.createdAt)],
    ['Provider', providerLabel(c.providerCode)],
    ['Action', c.action ? CALL_ACTION_LABEL[c.action] : '—'],
    ['Direction', c.direction === 'INBOUND' ? 'Inbound (webhook)' : 'Outbound'],
    ['Result', <SuccessChip key="r" success={c.success} />],
    ['HTTP', [c.httpMethod, c.endpoint].filter(Boolean).join(' ') || '—'],
    [
      'Status',
      c.httpStatus ??
        (c.providerCode === 'MANUAL' && !c.endpoint ? 'None (Manual calls no one)' : 'No answer'),
    ],
    ['Latency', c.latencyMs == null ? '—' : `${c.latencyMs} ms`],
    ['Attempt', c.attempt ?? 1],
    [
      'Order',
      c.orderId && c.orderNumber ? (
        <Link className="font-mono underline underline-offset-2" to={`/orders/${c.orderId}`}>
          {c.orderNumber}
        </Link>
      ) : (
        '—'
      ),
    ],
    ['AWB', c.awb ? <span className="font-mono">{c.awb}</span> : '—'],
    ['Provider error code', c.providerErrorCode ?? '—'],
    [
      'Triggered by',
      c.triggeredByKind === 'SYSTEM'
        ? 'The system (a sweep)'
        : c.triggeredBy
          ? `A team member (${c.triggeredBy})`
          : (c.triggeredByKind ?? '—'),
    ],
  ]
  if (c.responseBytes != null) {
    rows.push(['Label file', `${c.responseBytes.toLocaleString('en-IN')} bytes, ${c.responsePages ?? '?'} pages (not kept)`])
  }
  return (
    <div className="flex flex-col gap-4">
      {c.sentence && (
        <p role="note" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {c.sentence}
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      <BodyBlock title="Request" body={query.data.requestBody} />
      <BodyBlock title="Response" body={query.data.responseBody} />
    </div>
  )
}

/** The log's drawer: one call opened from the shipping log. */
function ShippingCallDrawer({ callId, onClose }: { callId: string | undefined; onClose: () => void }) {
  return (
    <Dialog open={!!callId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={DRAWER} aria-describedby="call-drawer-description">
        <DialogHeader>
          <DialogTitle>Shipping call</DialogTitle>
          <DialogDescription id="call-drawer-description" className="font-mono text-xs break-all">
            {callId}
          </DialogDescription>
        </DialogHeader>
        {callId && <CallDetail id={callId} />}
      </DialogContent>
    </Dialog>
  )
}

/** A shipment's own calls (the Shipment panel's Log link), each opening in place. */
function ShipmentLogDrawer({
  open,
  calls,
  awb,
  onClose,
}: {
  open: boolean
  calls: ShippingCallSummary[]
  awb: string | null | undefined
  onClose: () => void
}) {
  const [callId, setCallId] = React.useState<string | undefined>()
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setCallId(undefined)
          onClose()
        }
      }}
    >
      <DialogContent className={DRAWER} aria-describedby="shipment-log-description">
        <DialogHeader>
          <DialogTitle>Shipment log</DialogTitle>
          <DialogDescription id="shipment-log-description">
            Every exchange with the provider about {awb ? <span className="font-mono">{awb}</span> : 'this shipment'}, newest first.
          </DialogDescription>
        </DialogHeader>
        {callId ? (
          <div className="flex flex-col gap-3">
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => setCallId(undefined)}>
              <ArrowLeftIcon /> All calls
            </Button>
            <CallDetail id={callId} />
          </div>
        ) : calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">No calls are recorded for this shipment.</p>
        ) : (
          <ol aria-label="Shipment calls" className="flex flex-col gap-2">
            {calls.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setCallId(c.id)}
                  className="flex w-full flex-col gap-0.5 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.action ? CALL_ACTION_LABEL[c.action] : '—'}</span>
                    <SuccessChip success={c.success} />
                    <span className="text-xs text-muted-foreground">
                      {providerLabel(c.providerCode)}
                      {c.httpStatus != null && ` · HTTP ${c.httpStatus}`}
                      {c.latencyMs != null && ` · ${c.latencyMs} ms`}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                  {c.sentence && <span className="text-xs">{c.sentence}</span>}
                </button>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { ShippingCallDrawer, ShipmentLogDrawer, SuccessChip }
