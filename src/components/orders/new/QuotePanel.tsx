import type { AdminQuote } from '@/api/orders'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isApiError } from '@/lib/api-error'
import { placeRefusals, rupees } from '@/lib/orders'

export type QuoteState =
  | { kind: 'idle'; why: string }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; quote: AdminQuote }

/** Turns the query's outcome, and whether it answers the current request, into what the panel shows. */
export function quoteState(input: {
  hasRequest: boolean
  current: boolean
  isFetching: boolean
  isError: boolean
  error: unknown
  data: AdminQuote | undefined
  idleReason: string
}): QuoteState {
  if (!input.hasRequest) {
    return { kind: 'idle', why: input.idleReason }
  }
  if (!input.current || input.isFetching) {
    return { kind: 'loading' }
  }
  if (input.isError) {
    return {
      kind: 'error',
      message: isApiError(input.error) ? input.error.message : 'The quote could not be read.',
    }
  }
  return input.data ? { kind: 'ready', quote: input.data } : { kind: 'loading' }
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'text-base font-semibold' : 'text-sm'}`}>
      <dt className={strong ? undefined : 'text-muted-foreground'}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

/** The server's quote, as it stands now. Every figure here is the server's; none can be typed. */
function QuotePanel({ state }: { state: QuoteState }) {
  return (
    <Card role="region" aria-label="Quote">
      <CardHeader>
        <CardTitle>Quote</CardTitle>
        <CardDescription>What OMS will charge. It updates as you change the order.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3" aria-live="polite">
        {state.kind === 'idle' && <p className="text-sm text-muted-foreground">{state.why}</p>}
        {state.kind === 'loading' && <p className="text-sm text-muted-foreground">Getting the quote…</p>}
        {state.kind === 'error' && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        {state.kind === 'ready' && <QuoteBody quote={state.quote} />}
      </CardContent>
    </Card>
  )
}

function QuoteBody({ quote }: { quote: AdminQuote }) {
  const general = placeRefusals(quote).general
  return (
    <>
      <ul className="flex flex-col gap-1 text-sm">
        {(quote.lines ?? []).map((l) => (
          <li key={l.variantId} className="flex justify-between gap-3">
            <span>
              {l.productName}
              {l.variantName ? ` · ${l.variantName}` : ''} × {l.quantity}
            </span>
            <span className="tabular-nums">{rupees(l.lineTotalMinor)}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1 border-t pt-3">
        <Row label="Items" value={rupees(quote.itemTotalMinor)} />
        {(quote.savingsMinor ?? 0) > 0 && (
          <Row label="You save against MRP" value={rupees(quote.savingsMinor)} />
        )}
        <Row
          label={quote.freeShipping ? 'Shipping (free for this tier)' : 'Shipping'}
          value={rupees(quote.shippingMinor)}
        />
        <Row label="Payable" value={rupees(quote.payableMinor)} strong />
        <Row label="GST included" value={rupees(quote.gstMinor)} />
      </dl>
      <p className="text-xs text-muted-foreground" data-testid="quote-earns">
        This order will earn {(quote.earnPoints ?? 0).toLocaleString('en-IN')} Bits and{' '}
        {rupees(quote.earnCarrotsMinor)} Carrots.
      </p>
      {general.length > 0 && (
        <ul className="flex flex-col gap-1">
          {general.map((s) => (
            <li key={s} role="alert" className="text-sm text-destructive">
              {s}
            </li>
          ))}
        </ul>
      )}
      {!quote.placeable && general.length === 0 && (quote.refusals ?? []).length === 0 && (
        <p role="alert" className="text-sm text-destructive">
          OMS will not place this order as it stands.
        </p>
      )}
    </>
  )
}

export { QuotePanel }
