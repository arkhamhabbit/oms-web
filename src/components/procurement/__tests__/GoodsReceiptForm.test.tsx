import { calls, json, refusal, resetFetch, respondWith } from '@/test/fake-fetch'
import { installRadixPolyfills } from '@/test/polyfills'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GoodsReceiptForm } from '@/components/procurement/GoodsReceiptForm'
import type { PurchaseOrder } from '@/api/procurement'

installRadixPolyfills()

const order: PurchaseOrder = {
  id: 'po-1',
  poNumber: 'PO-000001',
  status: 'APPROVED',
  warehouseCode: 'W31',
  lines: [
    {
      id: 'l-1',
      skuCode: 'W3-0-PRODUCT',
      productName: 'Review product',
      variantId: 'v-1',
      quantityOrdered: 6,
      quantityReceived: 0,
      quantityOutstanding: 6,
      batchTracked: false,
    },
  ],
}

const batchOrder: PurchaseOrder = {
  ...order,
  lines: [{ ...order.lines![0], batchTracked: true }],
}

function render(po: PurchaseOrder, onPosted = vi.fn()) {
  rtlRender(
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <GoodsReceiptForm order={po} onPosted={onPosted} />
      </QueryClientProvider>
    </MemoryRouter>
  )
  return onPosted
}

const posts = () => calls.filter((c) => c.method === 'POST')

beforeEach(() => {
  resetFetch()
  respondWith((call) =>
    call.url.pathname === '/api/admin/batches'
      ? json(200, { content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 })
      : json(200, {})
  )
})

describe('GoodsReceiptForm', () => {
  it('prefills accepted with what remains and posts a partial under one key', async () => {
    const user = userEvent.setup()
    respondWith(() => json(201, { id: 'g-1', grnNumber: 'GRN-000001' }))
    const onPosted = render(order)
    const accepted = screen.getByLabelText('Accepted')
    expect(accepted).toHaveValue('6')
    await user.clear(accepted)
    await user.type(accepted, '4')
    await user.type(screen.getByLabelText("Supplier's invoice number"), 'INV-7')
    await user.click(screen.getByRole('button', { name: 'Post receipt' }))

    await waitFor(() => expect(posts()).toHaveLength(1))
    const call = posts()[0]
    expect(call.url.searchParams.get('purchaseOrderId')).toBe('po-1')
    expect(call.headers.get('Idempotency-Key')).toBeTruthy()
    expect(call.body).toMatchObject({
      supplierInvoiceNumber: 'INV-7',
      lines: [{ purchaseOrderLineId: 'l-1', quantityReceived: 4, quantityRejected: 0 }],
    })
    await waitFor(() =>
      expect(onPosted).toHaveBeenCalledWith(expect.objectContaining({ id: 'g-1' }))
    )
  })

  it("shows the server's over-receipt sentence under the lines, never resends, and mints a fresh key on the next click", async () => {
    const sentence = 'Line 1 would exceed the order: ordered 6, received 0, attempted 9.'
    const user = userEvent.setup()
    respondWith((call) =>
      call.method === 'POST'
        ? refusal(422, 'BUSINESS_RULE_VIOLATION', sentence)
        : json(200, { content: [] })
    )
    render(order)
    await user.clear(screen.getByLabelText('Accepted'))
    await user.type(screen.getByLabelText('Accepted'), '9')
    await user.click(screen.getByRole('button', { name: 'Post receipt' }))

    expect(await screen.findByText(sentence)).toBeInTheDocument()
    expect(screen.getByText(/Nothing was resent/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'open PO-000001' })).toHaveAttribute(
      'href',
      '/procurement/purchase-orders/po-1'
    )
    // No silent retry: exactly one POST so far.
    await new Promise((r) => setTimeout(r, 50))
    expect(posts()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Post again' }))
    await waitFor(() => expect(posts()).toHaveLength(2))
    expect(posts()[1].headers.get('Idempotency-Key')).not.toBe(
      posts()[0].headers.get('Idempotency-Key')
    )
  })

  it('requires a batch for a batch-tracked line and creates one inline from its dates', async () => {
    const user = userEvent.setup()
    respondWith((call) =>
      call.method === 'POST'
        ? json(201, { id: 'g-2', grnNumber: 'GRN-000002' })
        : json(200, { content: [] })
    )
    render(batchOrder)
    const post = screen.getByRole('button', { name: 'Post receipt' })
    expect(post).toBeDisabled()
    expect(screen.getByText(/batch-tracked: pick a batch or create one/i)).toBeInTheDocument()

    await user.click(screen.getByLabelText('New batch'))
    await user.type(screen.getByLabelText('Batch number for W3-0-PRODUCT'), 'W31-B1')
    await user.type(screen.getByLabelText('Expires on for W3-0-PRODUCT'), '2027-06-30')
    expect(post).toBeEnabled()
    await user.click(post)

    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].body).toMatchObject({
      lines: [{ batchNumber: 'W31-B1', expiresOn: '2027-06-30', quantityReceived: 6 }],
    })
    expect((posts()[0].body as { lines: Record<string, unknown>[] }).lines[0]).not.toHaveProperty(
      'batchId'
    )
  })

  it('leaves a line with nothing accepted or rejected out of the request', async () => {
    const user = userEvent.setup()
    respondWith(() => json(201, { id: 'g-3', grnNumber: 'GRN-000003' }))
    render({
      ...order,
      lines: [
        order.lines![0],
        { ...order.lines![0], id: 'l-2', skuCode: 'OTHER', variantId: 'v-2' },
      ],
    })
    await user.clear(screen.getAllByLabelText('Accepted')[1])
    await user.type(screen.getAllByLabelText('Accepted')[1], '0')
    await user.click(screen.getByRole('button', { name: 'Post receipt' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    const lines = (posts()[0].body as { lines: { purchaseOrderLineId: string }[] }).lines
    expect(lines.map((l) => l.purchaseOrderLineId)).toEqual(['l-1'])
  })
})
