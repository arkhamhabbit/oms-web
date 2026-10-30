import { calls, json, refusal, resetFetch, respondWith } from '@/test/fake-fetch'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type * as React from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  useCreatePurchaseOrderMutation,
  useGoodsReceiptsQuery,
  useOpenPurchaseOrdersQuery,
  usePostGoodsReceiptMutation,
  usePurchaseOrderActionMutation,
  usePurchaseOrderReceiptsQuery,
  usePurchaseOrdersQuery,
  useSupplierActiveMutation,
  useSuppliersQuery,
  useUpdatePurchaseOrderMutation,
  useUpdateSupplierMutation,
} from '@/api/procurement'

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

const page = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }

beforeEach(() => {
  resetFetch()
  respondWith(() => json(200, page))
})

describe('procurement data layer — default (no-filter) paths, D2.10', () => {
  it('reads suppliers, purchase orders, the open view and receipts with only paging', async () => {
    const w = wrapper()
    renderHook(() => useSuppliersQuery({ page: 0, size: 20 }), { wrapper: w })
    renderHook(() => usePurchaseOrdersQuery({ page: 0, size: 20 }), { wrapper: w })
    renderHook(() => useOpenPurchaseOrdersQuery({ page: 0, size: 20 }), { wrapper: w })
    renderHook(() => useGoodsReceiptsQuery({ page: 0, size: 20 }), { wrapper: w })
    await waitFor(() => expect(calls.length).toBe(4))
    for (const call of calls) {
      expect([...call.url.searchParams.keys()].sort()).toEqual(['page', 'size'])
    }
    expect(calls.map((c) => c.url.pathname).sort()).toEqual([
      '/api/admin/goods-receipts',
      '/api/admin/purchase-orders',
      '/api/admin/purchase-orders/open',
      '/api/admin/suppliers',
    ])
  })

  it('narrows purchase orders by status, supplier, warehouse and expected dates', async () => {
    renderHook(
      () =>
        usePurchaseOrdersQuery({
          page: 0,
          size: 20,
          status: 'PARTIALLY_RECEIVED',
          supplierId: 's1',
          warehouseId: 'w1',
          expectedFrom: '2026-10-01',
          expectedTo: '2026-10-31',
          search: '',
        }),
      { wrapper: wrapper() }
    )
    await waitFor(() => expect(calls.length).toBe(1))
    const q = calls[0].url.searchParams
    expect(q.get('status')).toBe('PARTIALLY_RECEIVED')
    expect(q.get('supplierId')).toBe('s1')
    expect(q.get('warehouseId')).toBe('w1')
    expect(q.get('expectedFrom')).toBe('2026-10-01')
    expect(q.get('expectedTo')).toBe('2026-10-31')
    expect(q.has('search')).toBe(false)
  })

  it("reads an order's receipts from the nested path, and only when allowed to", async () => {
    renderHook(() => usePurchaseOrderReceiptsQuery('po1', false), { wrapper: wrapper() })
    await new Promise((r) => setTimeout(r, 20))
    expect(calls).toHaveLength(0)
    respondWith(() => json(200, []))
    renderHook(() => usePurchaseOrderReceiptsQuery('po1'), { wrapper: wrapper() })
    await waitFor(() => expect(calls.length).toBe(1))
    expect(calls[0].url.pathname).toBe('/api/admin/purchase-orders/po1/receipts')
  })
})

describe('procurement data layer — writes', () => {
  it('sends the version on a supplier edit and the action on (de)activation', async () => {
    respondWith(() => json(200, { id: 's1' }))
    const edit = renderHook(() => useUpdateSupplierMutation('s1'), { wrapper: wrapper() })
    await edit.result.current.mutateAsync({
      code: 'W31-SUP',
      name: 'W3.1 Supplier',
      addressLine1: 'a',
      city: 'c',
      state: 's',
      pincode: 'p',
      paymentTermsDays: 30,
      version: 2,
    })
    expect(calls[0].body).toMatchObject({ version: 2, code: 'W31-SUP' })
    const toggle = renderHook(() => useSupplierActiveMutation('s1'), { wrapper: wrapper() })
    await toggle.result.current.mutateAsync('deactivate')
    expect(calls[1].url.pathname).toBe('/api/admin/suppliers/s1/deactivate')
  })

  it('creates a purchase order with money as {amountMinor, currency}', async () => {
    respondWith(() => json(201, { id: 'po1' }))
    const { result } = renderHook(() => useCreatePurchaseOrderMutation(), { wrapper: wrapper() })
    await result.current.mutateAsync({
      supplierId: 's1',
      warehouseId: 'w1',
      currency: 'INR',
      lines: [
        {
          variantId: 'v1',
          quantityOrdered: 5,
          unitCost: { amountMinor: 10000, currency: 'INR' },
          taxRate: 0,
        },
      ],
    })
    expect(calls[0].body).toMatchObject({
      currency: 'INR',
      lines: [{ quantityOrdered: 5, unitCost: { amountMinor: 10000, currency: 'INR' } }],
    })
  })

  it('replaces a draft with PUT carrying its poNumber and version', async () => {
    respondWith(() => json(200, { id: 'po1' }))
    const { result } = renderHook(() => useUpdatePurchaseOrderMutation('po1'), {
      wrapper: wrapper(),
    })
    await result.current.mutateAsync({
      poNumber: 'PO-000001',
      version: 0,
      warehouseId: 'w1',
      lines: [],
    })
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].body).toMatchObject({ poNumber: 'PO-000001', version: 0 })
  })

  it('approves with no body and cancels with the reason', async () => {
    respondWith(() => json(200, { id: 'po1' }))
    const { result } = renderHook(() => usePurchaseOrderActionMutation('po1'), {
      wrapper: wrapper(),
    })
    await result.current.mutateAsync({ action: 'approve' })
    await result.current.mutateAsync({ action: 'cancel', reason: 'Wrong supplier' })
    expect(calls[0].url.pathname).toBe('/api/admin/purchase-orders/po1/approve')
    expect(calls[1].url.pathname).toBe('/api/admin/purchase-orders/po1/cancel')
    expect(calls[1].body).toEqual({ reason: 'Wrong supplier' })
  })

  it('posts a receipt with the order id in the query and its Idempotency-Key header', async () => {
    respondWith(() => json(201, { id: 'g1', grnNumber: 'GRN-000001' }))
    const { result } = renderHook(() => usePostGoodsReceiptMutation(), { wrapper: wrapper() })
    await result.current.mutateAsync({
      idempotencyKey: 'key-3',
      purchaseOrderId: 'po1',
      body: { lines: [{ purchaseOrderLineId: 'l1', quantityReceived: 4 }] },
    })
    expect(calls[0].url.pathname).toBe('/api/admin/goods-receipts')
    expect(calls[0].url.searchParams.get('purchaseOrderId')).toBe('po1')
    expect(calls[0].headers.get('Idempotency-Key')).toBe('key-3')
    expect(calls[0].body).toMatchObject({
      lines: [{ purchaseOrderLineId: 'l1', quantityReceived: 4 }],
    })
  })

  it("surfaces the server's over-receipt sentence unchanged", async () => {
    respondWith(() =>
      refusal(422, 'BUSINESS_RULE_VIOLATION', 'Line 1 ordered 6, received 4, attempted 5.')
    )
    const { result } = renderHook(() => usePostGoodsReceiptMutation(), { wrapper: wrapper() })
    await expect(
      result.current.mutateAsync({
        idempotencyKey: 'k',
        purchaseOrderId: 'po1',
        body: { lines: [{ purchaseOrderLineId: 'l1', quantityReceived: 5 }] },
      })
    ).rejects.toMatchObject({ message: 'Line 1 ordered 6, received 4, attempted 5.' })
  })
})
