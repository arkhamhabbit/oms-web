import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from 'lucide-react'
import { toast } from 'sonner'

import { useAdminQuoteQuery, usePlaceAdminOrderMutation } from '@/api/orders'
import type { UserSummary } from '@/api/users'
import { usePermissions } from '@/auth/usePermissions'
import { RefusalText } from '@/components/common/RefusalText'
import { BasketBuilder } from '@/components/orders/new/BasketBuilder'
import { DeliveryChooser } from '@/components/orders/new/DeliveryChooser'
import { MemberChooser } from '@/components/orders/new/MemberChooser'
import { QuotePanel, quoteState } from '@/components/orders/new/QuotePanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { toRefusal, type Refusal } from '@/lib/refusal'
import { buildQuoteRequest, EMPTY_DELIVERY, type BasketLine, type DeliveryDraft } from '@/lib/new-order'
import { CREATE_ORDER_PERMISSION } from '@/lib/orders'
import { useDebounced } from '@/lib/use-debounced'

const QUOTE_DEBOUNCE_MS = 400
const NOTE_LIMIT = 500

function OrderNewPage() {
  useBreadcrumb([{ label: 'Orders', to: '/orders' }, { label: 'New order' }])
  const navigate = useNavigate()
  const { has, isLoading } = usePermissions()

  const [member, setMember] = React.useState<UserSummary | undefined>()
  const [lines, setLines] = React.useState<BasketLine[]>([])
  const [delivery, setDelivery] = React.useState<DeliveryDraft>(EMPTY_DELIVERY)
  const [note, setNote] = React.useState('')
  const [notify, setNotify] = React.useState(false)
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()

  // Changing the member drops the delivery: an address belongs to one member.
  function chooseMember(next: UserSummary | undefined) {
    setMember(next)
    setDelivery(EMPTY_DELIVERY)
    setRefusal(undefined)
  }

  const request = React.useMemo(
    () => buildQuoteRequest(member?.id, lines, delivery),
    [member?.id, lines, delivery]
  )
  // The quote is asked for once the order has stopped changing; an answer to an earlier request
  // never shows, because the request is the query's key.
  const settledRequest = useDebounced(request, QUOTE_DEBOUNCE_MS)
  const quoteQuery = useAdminQuoteQuery(settledRequest)
  const place = usePlaceAdminOrderMutation()

  if (!isLoading && !has(CREATE_ORDER_PERMISSION)) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <p role="alert" className="text-sm">
          You don’t have permission to place orders. It needs {CREATE_ORDER_PERMISSION}.
        </p>
      </div>
    )
  }

  const state = quoteState({
    hasRequest: !!request,
    current: settledRequest === request,
    isFetching: quoteQuery.isFetching,
    isError: quoteQuery.isError,
    error: quoteQuery.error,
    data: quoteQuery.data,
    idleReason: !member
      ? 'Choose a member to start.'
      : lines.length === 0
        ? 'Add something to the basket.'
        : 'Choose where it is delivered.',
  })
  const quote = state.kind === 'ready' ? state.quote : undefined
  const canPlace = !!quote?.placeable && !place.isPending

  function submit() {
    if (!member?.id || !request || !quote) {
      return
    }
    setRefusal(undefined)
    place
      .mutateAsync({
        // One key per press: a second press is a new order attempt, a resend of this one is not.
        idempotencyKey: crypto.randomUUID(),
        body: {
          ...request,
          quotedPayableMinor: quote.payableMinor,
          internalNote: note.trim() || undefined,
          notifyCustomer: notify,
        },
      })
      .then((order) => {
        toast.success(`Order ${order.number ?? ''} placed`.trim())
        navigate(`/orders/${order.id}`)
      })
      .catch((error) => {
        setRefusal(toRefusal(error, 'This order'))
        // The price may have moved: ask again so the panel shows what OMS says now.
        void quoteQuery.refetch()
      })
  }

  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      <h1 className="text-xl font-semibold">New order</h1>
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <MemberChooser value={member} onChange={chooseMember} />
          <BasketBuilder lines={lines} onChange={setLines} quote={quote} />
          <DeliveryChooser
            memberId={member?.id}
            memberMobile={member?.mobile}
            value={delivery}
            onChange={setDelivery}
          />
        </div>
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">
          <QuotePanel state={state} />
          <Card>
            <CardHeader>
              <CardTitle>Place order</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="internal-note">Internal note (optional)</Label>
                <textarea
                  id="internal-note"
                  rows={2}
                  maxLength={NOTE_LIMIT}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs"
                />
                <p className="text-xs text-muted-foreground">Seen by the team only.</p>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="notify-customer"
                  checked={notify}
                  onCheckedChange={(v) => setNotify(v === true)}
                />
                <Label htmlFor="notify-customer" className="text-sm leading-snug font-normal">
                  Text the payment link to the member
                </Label>
              </div>
              <Button disabled={!canPlace} onClick={submit}>
                {place.isPending ? 'Placing…' : 'Place order'}
              </Button>
              {!quote?.placeable && (
                <p className="text-xs text-muted-foreground">
                  Place order is on once the quote says it can be placed.
                </p>
              )}
              <RefusalText refusal={refusal} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/orders"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" /> Orders
    </Link>
  )
}

export default OrderNewPage
