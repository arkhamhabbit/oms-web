import { calls, json, refusal, resetFetch, respondWith } from '@/test/fake-fetch'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type * as React from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  useAdjustStockMutation,
  useBatchesQuery,
  useCreateWarehouseMutation,
  useStockLevelsQuery,
  useStockMovementsQuery,
  useStockReconcileQuery,
  useStockTotalsQuery,
  useTransferQuery,
  useTransferStockMutation,
  useUpdateWarehouseMutation,
  useWarehouseActiveMutation,
  useWarehousesQuery,
} from '@/api/inventory'

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

describe('inventory data layer — default (no-filter) paths, D2.10', () => {
  it('lists warehouses with only the paging parameters', async () => {
    const { result } = renderHook(() => useWarehousesQuery({ page: 0, size: 20 }), {
      wrapper: wrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(calls[0].url.pathname).toBe('/api/admin/warehouses')
    expect([...calls[0].url.searchParams.keys()].sort()).toEqual(['page', 'size'])
  })

  it('sends status, type and search when they are chosen — and omits a blank search', async () => {
    const { result } = renderHook(
      () => useWarehousesQuery({ page: 1, size: 20, active: false, type: 'OWN', search: '' }),
      { wrapper: wrapper() }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const q = calls[0].url.searchParams
    expect(q.get('active')).toBe('false')
    expect(q.get('type')).toBe('OWN')
    expect(q.get('page')).toBe('1')
    expect(q.has('search')).toBe(false)
  })

  it('reads totals, levels, movements and batches without stray filters', async () => {
    const w = wrapper()
    renderHook(() => useStockTotalsQuery({ page: 0, size: 20 }), { wrapper: w })
    renderHook(() => useStockLevelsQuery({ page: 0, size: 20 }), { wrapper: w })
    renderHook(() => useStockMovementsQuery({ page: 0, size: 20 }), { wrapper: w })
    renderHook(() => useBatchesQuery({ page: 0, size: 20 }), { wrapper: w })
    await waitFor(() => expect(calls.length).toBe(4))
    for (const call of calls) {
      expect([...call.url.searchParams.keys()].sort()).toEqual(['page', 'size'])
    }
    expect(calls.map((c) => c.url.pathname).sort()).toEqual([
      '/api/admin/batches',
      '/api/admin/stock/levels',
      '/api/admin/stock/movements',
      '/api/admin/stock/totals',
    ])
  })

  it('passes the movement date window as instants and the other filters by name', async () => {
    renderHook(
      () =>
        useStockMovementsQuery({
          page: 0,
          size: 20,
          variantId: 'v1',
          warehouseId: 'w1',
          batchId: 'b1',
          movementType: 'DAMAGE',
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-10-02T00:00:00.000Z',
        }),
      { wrapper: wrapper() }
    )
    await waitFor(() => expect(calls.length).toBe(1))
    const q = calls[0].url.searchParams
    expect(q.get('variantId')).toBe('v1')
    expect(q.get('warehouseId')).toBe('w1')
    expect(q.get('batchId')).toBe('b1')
    expect(q.get('movementType')).toBe('DAMAGE')
    expect(q.get('from')).toBe('2026-10-01T00:00:00.000Z')
    expect(q.get('to')).toBe('2026-10-02T00:00:00.000Z')
  })

  it('does not run the drift check until asked, then reads GET /stock/reconcile', async () => {
    respondWith(() => json(200, { matches: true, driftingLocations: 0, drifting: [] }))
    // react-query re-renders only for the fields a component reads; the Reconcile tab reads `data`.
    const { result } = renderHook(
      () => {
        const query = useStockReconcileQuery()
        void query.data
        return query
      },
      { wrapper: wrapper() }
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(calls).toHaveLength(0)
    await result.current.refetch()
    expect(calls).toHaveLength(1)
    expect(calls[0].url.pathname).toBe('/api/admin/stock/reconcile')
    await waitFor(() => expect(result.current.data?.matches).toBe(true))
  })

  it('does not look up a transfer until a reference id is given', async () => {
    renderHook(() => useTransferQuery(undefined), { wrapper: wrapper() })
    await new Promise((r) => setTimeout(r, 20))
    expect(calls).toHaveLength(0)
  })
})

describe('inventory data layer — writes', () => {
  it('creates a warehouse with the CSRF header', async () => {
    respondWith(() => json(201, { id: 'w1', code: 'W31' }))
    const { result } = renderHook(() => useCreateWarehouseMutation(), { wrapper: wrapper() })
    await result.current.mutateAsync({
      code: 'W31',
      name: 'W3.1 Warehouse',
      type: 'OWN',
      addressLine1: '1 Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
    })
    expect(calls[0].method).toBe('POST')
    expect(calls[0].headers.get('X-OMS-Csrf')).toBe('1')
    expect(calls[0].body).toMatchObject({ code: 'W31', type: 'OWN' })
  })

  it('sends the version on a warehouse edit and the action on (de)activation', async () => {
    respondWith(() => json(200, { id: 'w1' }))
    const edit = renderHook(() => useUpdateWarehouseMutation('w1'), { wrapper: wrapper() })
    await edit.result.current.mutateAsync({
      code: 'W31',
      name: 'N',
      type: 'OWN',
      addressLine1: 'a',
      city: 'c',
      state: 's',
      pincode: 'p',
      version: 3,
    })
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].url.pathname).toBe('/api/admin/warehouses/w1')
    expect(calls[0].body).toMatchObject({ version: 3 })

    const toggle = renderHook(() => useWarehouseActiveMutation('w1'), { wrapper: wrapper() })
    await toggle.result.current.mutateAsync('deactivate')
    await toggle.result.current.mutateAsync('reactivate')
    expect(calls[1].url.pathname).toBe('/api/admin/warehouses/w1/deactivate')
    expect(calls[2].url.pathname).toBe('/api/admin/warehouses/w1/reactivate')
  })

  it('posts an adjustment with its own Idempotency-Key header and signed quantity', async () => {
    respondWith(() => json(200, { id: 'm1' }))
    const { result } = renderHook(() => useAdjustStockMutation(), { wrapper: wrapper() })
    await result.current.mutateAsync({
      idempotencyKey: 'key-1',
      body: {
        variantId: 'v1',
        warehouseId: 'w1',
        movementType: 'DAMAGE',
        reasonCode: 'DAMAGED_IN_WAREHOUSE',
        quantity: -1,
      },
    })
    expect(calls[0].url.pathname).toBe('/api/admin/stock/adjust')
    expect(calls[0].headers.get('Idempotency-Key')).toBe('key-1')
    expect(calls[0].body).toMatchObject({ quantity: -1, movementType: 'DAMAGE' })
  })

  it('posts a transfer with its Idempotency-Key and a positive quantity', async () => {
    respondWith(() => json(200, { referenceId: 'r1' }))
    const { result } = renderHook(() => useTransferStockMutation(), { wrapper: wrapper() })
    await result.current.mutateAsync({
      idempotencyKey: 'key-2',
      body: { variantId: 'v1', fromWarehouseId: 'a', toWarehouseId: 'b', quantity: 2 },
    })
    expect(calls[0].url.pathname).toBe('/api/admin/stock/transfer')
    expect(calls[0].headers.get('Idempotency-Key')).toBe('key-2')
    expect(calls[0].body).toMatchObject({ quantity: 2, fromWarehouseId: 'a', toWarehouseId: 'b' })
  })

  it("turns the server's refusal into an error carrying its sentence", async () => {
    respondWith(() =>
      refusal(422, 'BUSINESS_RULE_VIOLATION', 'Cannot remove 10: only 3 on hand at W31.')
    )
    const { result } = renderHook(() => useAdjustStockMutation(), { wrapper: wrapper() })
    await expect(
      result.current.mutateAsync({
        idempotencyKey: 'k',
        body: { variantId: 'v', warehouseId: 'w', movementType: 'ADJUSTMENT', quantity: -10 },
      })
    ).rejects.toMatchObject({
      status: 422,
      code: 'BUSINESS_RULE_VIOLATION',
      message: 'Cannot remove 10: only 3 on hand at W31.',
    })
  })
})
