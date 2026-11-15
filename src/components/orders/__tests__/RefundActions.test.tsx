import { calls, json, refusal, resetFetch, respondWith } from '@/test/fake-fetch'
import { installRadixPolyfills } from '@/test/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import type { OrderDetail, OrderRefund } from '@/api/orders'
import { RefundSettlementDialog } from '@/components/orders/RefundSettlementDialog'
import { BreadcrumbProvider } from '@/layouts/breadcrumb-context'
import { refundGate } from '@/lib/orders'
import OrderDetailPage from '@/pages/OrderDetailPage'

installRadixPolyfills()

const BACKFILLED: OrderRefund = {
  id: 'r-1',
  requestedAt: '2026-11-10T08:00:00Z',
  method: 'GATEWAY',
  amountMinor: 84800,
  currency: 'INR',
  outcome: 'REFUSED',
  backfilled: true,
  failureSentence: 'The payment gateway refused the request.',
}

const OWED: OrderDetail = {
  id: 'o-1',
  number: 'HBT_10000006',
  status: 'CANCELLED',
  version: 7,
  consumerId: 'c-1',
  consumerName: 'Asha Rao',
  consumerMobile: '+919999900001',
  refundState: 'OWED',
  refunds: [BACKFILLED],
  payment: {
    status: 'REFUND_PENDING',
    gatewayStatus: 'CAPTURED',
    amountMinor: 84800,
    lastRefundError: 'The payment gateway refused the request.',
    refundRequestedByKind: 'SYSTEM',
  },
}

const LOST_ANSWER: OrderDetail = {
  ...OWED,
  refunds: [
    {
      id: 'r-2',
      requestedAt: '2026-11-15T09:00:00Z',
      requestedByName: 'Ops Admin',
      method: 'GATEWAY',
      amountMinor: 84800,
      outcome: 'REQUESTED',
    },
    BACKFILLED,
  ],
  payment: {
    ...OWED.payment,
    lastRefundError: 'The payment gateway did not answer the refund request.',
  },
}

const INITIATED: OrderDetail = {
  ...OWED,
  refundState: 'INITIATED',
  refunds: [{ ...LOST_ANSWER.refunds![0], outcome: 'INITIATED', gatewayRefundId: 'rfnd_123' }],
  payment: { ...OWED.payment, status: 'REFUND_INITIATED' },
}

const REFUNDED: OrderDetail = {
  ...OWED,
  status: 'REFUNDED',
  refundState: 'REFUNDED',
  refunds: [
    {
      id: 'r-3',
      requestedAt: '2026-11-15T09:00:00Z',
      requestedByName: 'Ops Admin',
      method: 'MANUAL',
      amountMinor: 84800,
      outcome: 'SETTLED',
      reference: 'UPI 4401',
      processedAt: '2026-11-15T09:01:00Z',
    },
  ],
  payment: { status: 'REFUNDED', amountMinor: 84800, refundMethod: 'MANUAL' },
  payableMinor: 84800,
}

const VOIDED: OrderDetail = {
  ...OWED,
  refundState: 'VOIDED',
  refunds: [],
  payment: {
    status: 'VOIDED',
    amountMinor: 84800,
    voidReason: 'The payment was authorised but never captured, so nothing was charged.',
  },
}

function render(ui: React.ReactElement) {
  return rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>
  )
}

function renderPage(order: OrderDetail, permissions: string[]) {
  respondWith((call) => {
    if (call.url.pathname === '/api/admin/profile') {
      return json(200, { id: 'u', email: 'a@b.c', name: 'A', permissions, roles: [], version: 1 })
    }
    if (call.url.pathname === '/api/admin/orders') {
      return json(200, { content: [], totalElements: 3, totalPages: 1 })
    }
    return json(200, order)
  })
  return render(
    <MemoryRouter initialEntries={['/orders/o-1']}>
      <BreadcrumbProvider>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>
      </BreadcrumbProvider>
    </MemoryRouter>
  )
}

const FULL = ['orders.read', 'orders.write', 'orders.refund', 'orders.fulfil']

beforeEach(() => {
  resetFetch()
})

describe('refundGate', () => {
  it('opens both actions only for an owed payment with nothing in flight or unanswered', () => {
    expect(refundGate(OWED).canSettle).toBe(true)
    expect(refundGate(OWED).canGateway).toBe(true)
    expect(refundGate(LOST_ANSWER).canSettle).toBe(false)
    expect(refundGate(LOST_ANSWER).canRefresh).toBe(true)
    expect(refundGate(INITIATED).canSettle).toBe(false)
    expect(refundGate(INITIATED).canRefresh).toBe(true)
    expect(refundGate(VOIDED).canSettle).toBe(false)
    expect(refundGate(VOIDED).canRefresh).toBe(false)
    expect(refundGate({ ...OWED, refundState: 'NONE' }).visible).toBe(false)
  })

  it('keeps Razorpay off, with the reason, when the gateway does not show the payment captured', () => {
    const authorised = { ...OWED, payment: { ...OWED.payment, gatewayStatus: 'AUTHORIZED' as const } }
    const gate = refundGate(authorised)
    expect(gate.canSettle).toBe(true)
    expect(gate.canGateway).toBe(false)
    expect(gate.gatewayReason).toMatch(/does not show this payment as captured/)
  })
})

describe('refunds panel on an order that owes money', () => {
  it('shows Refund owed with the amount, both actions enabled, and the history with its backfilled row', async () => {
    renderPage(OWED, FULL)

    expect(await screen.findByTestId('refund-headline')).toHaveTextContent('Refund owed ₹848.00')
    expect(screen.getByRole('button', { name: 'Refund via Razorpay' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Mark as refunded' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Refresh status' })).not.toBeInTheDocument()

    const history = screen.getByRole('table', { name: 'Refund history' })
    expect(within(history).getByText('Refused')).toBeInTheDocument()
    expect(within(history).getByText('recorded from earlier history')).toBeInTheDocument()
    expect(
      within(history).getByText('The payment gateway refused the request.')
    ).toBeInTheDocument()
  })

  it('leaves both actions off without orders.refund and says what is needed', async () => {
    renderPage(OWED, ['orders.read'])

    const gateway = await screen.findByRole('button', { name: 'Refund via Razorpay' })
    expect(gateway).toBeDisabled()
    expect(gateway).toHaveAttribute('title', 'Needs orders.refund')
    expect(screen.getByRole('button', { name: 'Mark as refunded' })).toBeDisabled()
  })

  it('names the exact amount and the single gateway call in the confirm, and sends no amount', async () => {
    const user = userEvent.setup()
    renderPage(OWED, FULL)

    await user.click(await screen.findByRole('button', { name: 'Refund via Razorpay' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('refund-amount')).toHaveTextContent('₹848.00')
    expect(dialog).toHaveTextContent(/calls the gateway once/)
    const before = calls.filter((c) => c.method === 'POST')
    expect(before).toHaveLength(0)

    await user.click(within(dialog).getByRole('button', { name: 'Refund via Razorpay' }))
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1))
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url.pathname).toBe('/api/admin/orders/o-1/refund/gateway')
    expect(post.body).toEqual({ version: 7 })
    expect(post.headers.get('Idempotency-Key')).toBeTruthy()
  })
})

describe('the lost-answer state', () => {
  it('disables both refund actions, shows the sentence, and offers only Refresh', async () => {
    const user = userEvent.setup()
    renderPage(LOST_ANSWER, FULL)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The payment gateway did not answer the refund request.'
    )
    expect(screen.getByRole('button', { name: 'Refund via Razorpay' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mark as refunded' })).toBeDisabled()
    const refresh = screen.getByRole('button', { name: 'Refresh status' })
    expect(refresh).toBeEnabled()

    await user.click(refresh)
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url.pathname).toBe('/api/admin/orders/o-1/refund/refresh')
    expect(post.body).toEqual({ version: 7 })
  })

  it('also holds both actions while a refund is initiated at the gateway', async () => {
    renderPage(INITIATED, FULL)

    expect(await screen.findByTestId('refund-headline')).toHaveTextContent(
      'Refund initiated — waiting for Razorpay'
    )
    expect(screen.getByRole('button', { name: 'Refund via Razorpay' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mark as refunded' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Refresh status' })).toBeEnabled()
  })
})

describe('a voided payment and a refunded order', () => {
  it('shows Voided with its reason and offers no refund action', async () => {
    renderPage(VOIDED, FULL)

    expect(await screen.findByTestId('refund-headline')).toHaveTextContent(
      'Voided — never captured, nothing charged'
    )
    expect(screen.getAllByText(/never captured, so nothing was charged/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Refund via Razorpay' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark as refunded' })).not.toBeInTheDocument()
  })

  it('shows Refunded, the reference in the history, and the Refunded and Net lines', async () => {
    renderPage(REFUNDED, FULL)

    expect(await screen.findByTestId('refund-headline')).toHaveTextContent('Refunded')
    const history = screen.getByRole('table', { name: 'Refund history' })
    expect(within(history).getByText('UPI 4401')).toBeInTheDocument()
    expect(within(history).getByText('Settled manually')).toBeInTheDocument()
    const totals = screen.getByRole('list', { hidden: true, name: 'Order history' })
    expect(totals).toBeInTheDocument()
    const ladder = screen.getByLabelText('Order totals')
    expect(within(ladder).getByText('Refunded')).toBeInTheDocument()
    expect(within(ladder).getByText('Net')).toBeInTheDocument()
  })
})

describe('RefundSettlementDialog', () => {
  it('will not mark as refunded without a reference, then sends reference and reason', async () => {
    const user = userEvent.setup()
    respondWith(() => json(200, REFUNDED))
    render(
      <RefundSettlementDialog
        order={OWED}
        kind="mark-refunded"
        onClose={() => {}}
        onStale={() => {}}
      />
    )

    const confirm = screen.getByRole('button', { name: 'Mark as refunded' })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText('Reference'), 'UPI 4401')
    await user.type(screen.getByLabelText('Reason (optional)'), 'Paid by transfer')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].url.pathname).toBe('/api/admin/orders/o-1/refund/mark-refunded')
    expect(calls[0].body).toEqual({ version: 7, reference: 'UPI 4401', reason: 'Paid by transfer' })
  })

  it('shows a refusal of the reference beside its box', async () => {
    const user = userEvent.setup()
    respondWith(() =>
      refusal(400, 'VALIDATION_FAILED', 'Some fields are not valid. Correct them and retry.', [
        { field: 'reference', message: 'Enter how it was settled.' },
      ] as never)
    )
    render(
      <RefundSettlementDialog
        order={OWED}
        kind="mark-refunded"
        onClose={() => {}}
        onStale={() => {}}
      />
    )

    await user.type(screen.getByLabelText('Reference'), 'x')
    await user.click(screen.getByRole('button', { name: 'Mark as refunded' }))

    expect(await screen.findByText('Enter how it was settled.')).toBeInTheDocument()
    expect(screen.getByLabelText('Reference')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows the server sentence when Razorpay is refused', async () => {
    const user = userEvent.setup()
    respondWith(() =>
      refusal(422, 'RULE_VIOLATION', 'The payment was never captured, so there is nothing to refund.')
    )
    render(
      <RefundSettlementDialog order={OWED} kind="gateway" onClose={() => {}} onStale={() => {}} />
    )

    await user.click(screen.getByRole('button', { name: 'Refund via Razorpay' }))
    expect(
      await screen.findByText('The payment was never captured, so there is nothing to refund.')
    ).toBeInTheDocument()
  })
})
