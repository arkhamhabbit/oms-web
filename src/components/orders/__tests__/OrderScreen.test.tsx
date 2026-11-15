import { calls, json, resetFetch, respondWith } from '@/test/fake-fetch'
import { installRadixPolyfills } from '@/test/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import type { OrderDetail } from '@/api/orders'
import { buildFeed } from '@/components/orders/OrderNotesFeed'
import { BreadcrumbProvider } from '@/layouts/breadcrumb-context'
import { trackingUrl } from '@/lib/orders'
import OrderDetailPage from '@/pages/OrderDetailPage'
import OrdersPage from '@/pages/OrdersPage'

installRadixPolyfills()

const ORDER: OrderDetail = {
  id: 'o-1',
  number: 'HBT_10000005',
  status: 'CONFIRMED',
  version: 3,
  consumerId: 'c-1',
  consumerName: 'Asha Rao',
  consumerMobile: '+919999900001',
  tierCode: 'PLUS',
  freeShipping: true,
  itemTotalMinor: 80000,
  shippingMinor: 0,
  carrotsRedeemedMinor: 1000,
  bitsSpent: 50,
  payableMinor: 79000,
  gstMinor: 8464,
  gstBreakdown: [{ rate: 12, taxableMinor: 70536, taxMinor: 8464 }],
  refundState: 'NONE',
  lines: [
    {
      lineNumber: 1,
      productName: 'Test Public Tee',
      variantName: 'M',
      skuCode: 'TEE-M',
      quantity: 1,
      unitPriceMinor: 80000,
      gstRate: 12,
      lineTotalMinor: 80000,
    },
  ],
  payment: {
    status: 'CAPTURED',
    gatewayStatus: 'AUTHORIZED',
    gatewayStatusAt: '2026-11-15T09:00:00Z',
    amountMinor: 79000,
    gatewayOrderId: 'order_X1',
    gatewayPaymentId: 'pay_X1',
  },
  events: [
    { id: 'e1', kind: 'STATUS', toStatus: 'PENDING_PAYMENT', occurredAt: '2026-11-15T08:00:00Z' },
    {
      id: 'e2',
      kind: 'STATUS',
      fromStatus: 'PENDING_PAYMENT',
      toStatus: 'CONFIRMED',
      actorKind: 'SYSTEM',
      occurredAt: '2026-11-15T08:05:00Z',
    },
    {
      id: 'e3',
      kind: 'NOTE',
      note: 'Customer called about the address',
      actorName: 'Ops Admin',
      occurredAt: '2026-11-15T08:30:00Z',
    },
  ],
}

function render(ui: React.ReactElement, path: string, route: string) {
  return rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <BreadcrumbProvider>
          <Routes>
            <Route path={route} element={ui} />
          </Routes>
        </BreadcrumbProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function serve(permissions: string[], order: OrderDetail = ORDER) {
  respondWith((call) => {
    if (call.url.pathname === '/api/admin/profile') {
      return json(200, { id: 'u', email: 'a@b.c', name: 'A', permissions, roles: [], version: 1 })
    }
    if (call.url.pathname === '/api/admin/orders') {
      const owed = call.url.searchParams.get('refundState') === 'OWED'
      return json(200, {
        content: owed
          ? [{ id: 'o-6', number: 'HBT_10000006', status: 'CANCELLED', refundState: 'OWED', payableMinor: 84800, paymentMethod: 'UPI', confirmedAt: '2026-11-10T08:00:00Z' }]
          : [{ id: 'o-5', number: 'HBT_10000005', status: 'CONFIRMED', refundState: 'NONE', payableMinor: 79000, paymentMethod: 'UPI', confirmedAt: '2026-11-15T08:05:00Z' }],
        totalElements: owed ? 1 : 2,
        totalPages: 1,
      })
    }
    if (call.url.pathname === '/api/admin/orders/settings') {
      return json(200, { shippingFeeMinor: 4900, paymentTimeoutMinutes: 15, cancelUntil: 'PACKED' })
    }
    if (call.url.pathname.endsWith('/notes')) {
      return json(200, order)
    }
    return json(200, order)
  })
}

beforeEach(() => {
  resetFetch()
})

describe('the order page', () => {
  it('shows payment status beside gateway status, and the totals ladder', async () => {
    serve(['orders.read'])
    render(<OrderDetailPage />, '/orders/o-1', '/orders/:id')

    expect(await screen.findByText('Payment status')).toBeInTheDocument()
    expect(screen.getByText('Gateway status')).toBeInTheDocument()
    expect(screen.getByText('Authorized, not captured')).toBeInTheDocument()
    expect(screen.getByText(/but Razorpay last reported it as/)).toBeInTheDocument()

    const ladder = screen.getByLabelText('Order totals')
    expect(within(ladder).getByText('Amount paid')).toBeInTheDocument()
    expect(within(ladder).getByText(/Free/)).toBeInTheDocument()
    expect(within(ladder).queryByText('Refunded')).not.toBeInTheDocument()
    expect(screen.queryByTestId('refund-headline')).not.toBeInTheDocument()
  })

  it('is read-only without the write keys, with Needs hints', async () => {
    serve(['orders.read'])
    render(<OrderDetailPage />, '/orders/o-1', '/orders/:id')

    const pack = await screen.findAllByRole('button', { name: 'Pack' })
    expect(pack).toHaveLength(2) // the header and the actions box
    pack.forEach((b) => expect(b).toBeDisabled())
    expect(screen.getByLabelText('Add note')).toBeDisabled()
    expect(screen.getAllByText('Needs orders.fulfil').length).toBeGreaterThan(0)
  })

  it('adds a private note with an Idempotency-Key and no version', async () => {
    const user = userEvent.setup()
    serve(['orders.read', 'orders.write'])
    render(<OrderDetailPage />, '/orders/o-1', '/orders/:id')

    await user.type(await screen.findByLabelText('Add note'), 'W3.6 review note')
    await user.click(screen.getByRole('button', { name: 'Add note' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url.pathname).toBe('/api/admin/orders/o-1/notes')
    expect(post.body).toEqual({ text: 'W3.6 review note' })
    expect(post.headers.get('Idempotency-Key')).toBeTruthy()
  })
})

describe('the notes feed', () => {
  it('runs newest first and mixes system events, notes and refund events', () => {
    const feed = buildFeed({
      ...ORDER,
      refunds: [
        {
          id: 'r1',
          requestedAt: '2026-11-15T09:00:00Z',
          requestedByName: 'Ops Admin',
          method: 'GATEWAY',
          amountMinor: 79000,
          outcome: 'FAILED',
          failedAt: '2026-11-15T09:02:00Z',
          failureSentence: 'Insufficient balance',
        },
      ],
    })
    expect(feed.map((f) => f.kind)).toEqual(['REFUND', 'REFUND', 'NOTE', 'STATUS', 'STATUS'])
    const note = feed.find((f) => f.kind === 'NOTE')!
    expect(note.title).toBe('Customer called about the address')
    expect(note.author).toBe('Ops Admin')
    expect(feed[0].detail).toBe('Insufficient balance')
  })

  it('highlights notes and mutes system entries on the page', async () => {
    serve(['orders.read'])
    render(<OrderDetailPage />, '/orders/o-1', '/orders/:id')

    const items = within(await screen.findByRole('list', { name: 'Order history' })).getAllByRole(
      'listitem'
    )
    expect(items.map((i) => i.getAttribute('data-kind'))).toEqual(['NOTE', 'STATUS', 'STATUS'])
    expect(items[0]).toHaveTextContent('Ops Admin')
  })
})

describe('tracking links', () => {
  it('links only a carrier whose pattern is known', () => {
    expect(trackingUrl('Delhivery', 'ABC123')).toContain('ABC123')
    expect(trackingUrl('Local courier', 'ABC123')).toBeUndefined()
    expect(trackingUrl('Delhivery', undefined)).toBeUndefined()
  })
})

describe('the orders list', () => {
  it('shows the refunds owed count in the page header, whatever the filters say', async () => {
    serve(['orders.read'])
    render(<OrdersPage />, '/orders', '/orders')

    const count = await screen.findByLabelText('Refunds owed count')
    await waitFor(() => expect(count).toHaveTextContent('1'))
  })

  it('has the Refunds owed preset find the owed order, and a refund column', async () => {
    const user = userEvent.setup()
    serve(['orders.read'])
    render(<OrdersPage />, '/orders', '/orders')

    expect(await screen.findByText('HBT_10000005')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Refunds owed/ }))

    expect(await screen.findByText('HBT_10000006')).toBeInTheDocument()
    expect(screen.getAllByText('Refund owed').length).toBeGreaterThan(0)
    const listCall = calls
      .filter((c) => c.url.pathname === '/api/admin/orders')
      .filter((c) => c.url.searchParams.get('size') === '20')
      .at(-1)!
    expect(listCall.url.searchParams.get('refundState')).toBe('OWED')
  })
})
