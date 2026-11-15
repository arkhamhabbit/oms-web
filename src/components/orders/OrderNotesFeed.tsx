import * as React from 'react'
import { toast } from 'sonner'

import { usePermissions } from '@/auth/usePermissions'
import { useAddOrderNoteMutation, type OrderDetail } from '@/api/orders'
import { noticeFromError } from '@/components/common/NoticeBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/dates'
import { labelOf, ORDER_STATUS_LABEL, REFUND_METHOD_LABEL } from '@/lib/labels'
import { rupees } from '@/lib/orders'
import { cn } from '@/lib/utils'

const NOTE_LIMIT = 2000

export interface FeedEntry {
  key: string
  at: string
  kind: 'NOTE' | 'STATUS' | 'REFUND'
  title: string
  detail?: string
  author?: string
}

/**
 * One reverse-chronological feed: system events (`order_event`), refund events from the refund
 * rows, and private notes. Notes are the only entries an admin wrote, so only they are highlighted.
 */
export function buildFeed(order: OrderDetail): FeedEntry[] {
  const entries: FeedEntry[] = []
  for (const e of order.events ?? []) {
    if (e.kind === 'NOTE') {
      entries.push({
        key: `e-${e.id}`,
        at: e.occurredAt ?? '',
        kind: 'NOTE',
        title: e.note ?? '',
        author: e.actorName ?? 'Unknown admin',
      })
    } else if (e.fromStatus && e.fromStatus === e.toStatus && e.note) {
      // A system remark that moved nothing: the sentence is the entry.
      entries.push({
        key: `e-${e.id}`,
        at: e.occurredAt ?? '',
        kind: 'STATUS',
        title: e.note,
        detail: e.actorKind?.toLowerCase(),
      })
    } else {
      entries.push({
        key: `e-${e.id}`,
        at: e.occurredAt ?? '',
        kind: 'STATUS',
        title: e.fromStatus
          ? `${labelOf(ORDER_STATUS_LABEL, e.fromStatus)} → ${labelOf(ORDER_STATUS_LABEL, e.toStatus)}`
          : `Placed (${labelOf(ORDER_STATUS_LABEL, e.toStatus)})`,
        detail: [e.actorKind?.toLowerCase(), e.note].filter(Boolean).join(' · ') || undefined,
      })
    }
  }
  for (const r of order.refunds ?? []) {
    const how = labelOf(REFUND_METHOD_LABEL, r.method)
    const amount = rupees(r.amountMinor)
    entries.push({
      key: `r-${r.id}-req`,
      at: r.requestedAt ?? '',
      kind: 'REFUND',
      title: `Refund of ${amount} requested (${how})`,
      detail: r.requestedByName ?? (r.backfilled ? 'recorded from earlier history' : undefined),
    })
    if (r.processedAt) {
      entries.push({
        key: `r-${r.id}-ok`,
        at: r.processedAt,
        kind: 'REFUND',
        title: `Refund of ${amount} ${r.outcome === 'SETTLED' ? 'settled' : 'processed'}`,
      })
    }
    if (r.failedAt) {
      entries.push({
        key: `r-${r.id}-fail`,
        at: r.failedAt,
        kind: 'REFUND',
        title: `Refund of ${amount} failed`,
        detail: r.failureSentence ?? undefined,
      })
    }
  }
  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

function AddNote({ order }: { order: OrderDetail }) {
  const { has } = usePermissions()
  const mutation = useAddOrderNoteMutation(order.id!)
  const [text, setText] = React.useState('')
  const [key, setKey] = React.useState(() => crypto.randomUUID())
  const [refusal, setRefusal] = React.useState<string | undefined>()
  const allowed = has('orders.write')
  const trimmed = text.trim()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setRefusal(undefined)
    mutation
      .mutateAsync({ text: trimmed, idempotencyKey: key })
      .then(() => {
        toast.success('Note added')
        setText('')
        setKey(crypto.randomUUID())
      })
      .catch((error) => setRefusal(noticeFromError(error, 'This order').text))
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="order-note" className="text-sm font-medium">
        Add note
      </label>
      <textarea
        id="order-note"
        rows={3}
        maxLength={NOTE_LIMIT}
        value={text}
        disabled={!allowed}
        title={allowed ? undefined : 'Needs orders.write'}
        placeholder="Private note — never shown to the shopper"
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {text.length}/{NOTE_LIMIT}
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={!allowed || !trimmed || mutation.isPending}
          title={allowed ? undefined : 'Needs orders.write'}
        >
          Add note
        </Button>
      </div>
      {refusal && (
        <p role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      )}
    </form>
  )
}

function OrderNotesFeed({ order }: { order: OrderDetail }) {
  const feed = buildFeed(order)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes and history</CardTitle>
        <CardDescription>Newest first. Notes are private to the team.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AddNote order={order} />
        <ol aria-label="Order history" className="flex flex-col gap-2">
          {feed.map((entry) => (
            <li
              key={entry.key}
              data-kind={entry.kind}
              className={cn(
                'rounded-md px-3 py-2 text-sm',
                entry.kind === 'NOTE'
                  ? 'border border-amber-300 bg-amber-50 text-foreground dark:border-amber-700 dark:bg-amber-950/40'
                  : 'text-muted-foreground'
              )}
            >
              <div className={cn(entry.kind === 'NOTE' ? 'break-words whitespace-pre-wrap' : '')}>
                {entry.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDateTime(entry.at)}
                {entry.author ? ` · ${entry.author}` : ''}
                {entry.detail ? ` · ${entry.detail}` : ''}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

export { OrderNotesFeed }
