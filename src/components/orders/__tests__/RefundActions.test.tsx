import { calls, json, refusal, resetFetch, respondWith } from '@/test/fake-fetch'
import { installRadixPolyfills } from '@/test/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import type { OrderDetail } from '@/api/orders'
import { RefundSettlementDialog } from '@/components/orders/RefundSettlementDialog'
import { BreadcrumbProvider } from '@/layouts/breadcrumb-context'
import { isRefundPending } from '@/lib/orders'
import OrderDetailPage from '@/pages/OrderDetailPage'

installRadixPolyfills()

const PENDING: OrderDetail = {
  id: 'o-1',
  number: 'HBT_10000009',
  status: 'CANCELLED',
  version: 7,
  consumerId: 'c-1',
  consumerName: 'Asha Rao',
  consumerMobile: '+919999900001',
  payment: {
    status: 'REFUND_PENDING',
    amountMinor: 84800,
    refundAttempts: 5,
    lastRefundError: 'The payment gateway does not recognise this payment.',
  },
}

const REFUNDED: OrderDetail = {
  ...PENDING,
  status: 'REFUNDED',
  payment: {
    status: 'REFUNDED',
    amountMinor: 84800,
    refundMethod: 'MANUAL',
    refundReference: 'UPI 4401',
    refundedAt: '2026-10-29T08:35:00Z',
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

beforeEach(() => {
  resetFetch()
})

describe('isRefundPending', () => {
  it('is true only for a payment the gateway has not finished refunding', () => {
    expect(isRefundPending(PENDING.payment)).toBe(true)
    expect(isRefundPending(REFUNDED.payment)).toBe(false)
    expect(isRefundPending(undefined)).toBe(false)
  })
})

describe('order detail on a refund the gateway keeps refusing', () => {
  it('shows the error sentence, the attempts, and both actions under orders.refund', async () => {
    renderPage(PENDING, ['orders.read', 'orders.refund'])

    expect(await screen.findByText('Refund needs attention')).toBeInTheDocument()
    expect(
      screen.getAllByText('The payment gateway does not recognise this payment.').length
    ).toBeGreaterThan(0)
    expect(screen.getByText(/Attempts so far: 5/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry refund' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Mark as refunded' })).toBeEnabled()
  })

  it('leaves both actions off without orders.refund', async () => {
    renderPage(PENDING, ['orders.read'])

    expect(await screen.findByRole('button', { name: 'Retry refund' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mark as refunded' })).toBeDisabled()
  })

  it('names the consumer and links to the user page', async () => {
    renderPage(PENDING, ['orders.read'])

    const link = await screen.findByRole('link', { name: /Asha Rao/ })
    expect(link).toHaveAttribute('href', '/users/c-1')
    expect(link).toHaveTextContent('+919999900001')
  })
})

describe('order detail once the refund is settled', () => {
  it('shows Refunded, the method and the reference, and no settlement actions', async () => {
    renderPage(REFUNDED, ['orders.read', 'orders.refund'])

    expect(await screen.findByText('Refund method')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(screen.getByText('UPI 4401')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry refund' })).not.toBeInTheDocument()
    expect(screen.queryByText('Refund needs attention')).not.toBeInTheDocument()
  })
})

describe('RefundSettlementDialog', () => {
  it('asks first, then retries with the order version and an Idempotency-Key', async () => {
    const user = userEvent.setup()
    respondWith(() => json(200, PENDING))
    render(<RefundSettlementDialog order={PENDING} kind="retry" onClose={() => {}} onStale={() => {}} />)

    expect(calls).toHaveLength(0)
    expect(screen.getByText(/attempt count goes back to zero/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry refund' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    const call = calls[0]
    expect(call.method).toBe('POST')
    expect(call.url.pathname).toBe('/api/admin/orders/o-1/refund/retry')
    expect(call.body).toEqual({ version: 7 })
    expect(call.headers.get('Idempotency-Key')).toBeTruthy()
  })

  it('will not mark as refunded without a reference, then sends reference and reason', async () => {
    const user = userEvent.setup()
    respondWith(() => json(200, REFUNDED))
    render(
      <RefundSettlementDialog order={PENDING} kind="mark-refunded" onClose={() => {}} onStale={() => {}} />
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

  it('shows a refusal of the reference beside its box, and a rule refusal in the dialog', async () => {
    const user = userEvent.setup()
    respondWith(() =>
      refusal(400, 'VALIDATION_FAILED', 'Some fields are not valid. Correct them and retry.', [
        { field: 'reference', message: 'Enter how it was settled.' },
      ] as never)
    )
    render(
      <RefundSettlementDialog order={PENDING} kind="mark-refunded" onClose={() => {}} onStale={() => {}} />
    )

    await user.type(screen.getByLabelText('Reference'), 'x')
    await user.click(screen.getByRole('button', { name: 'Mark as refunded' }))

    expect(await screen.findByText('Enter how it was settled.')).toBeInTheDocument()
    expect(screen.getByLabelText('Reference')).toHaveAttribute('aria-invalid', 'true')
  })
})
