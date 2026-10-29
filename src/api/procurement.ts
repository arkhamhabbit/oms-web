import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import { INVENTORY_KEY } from '@/api/inventory'
import type { components } from '@/api/schema.gen'

type Schemas = components['schemas']

export type Supplier = Schemas['SupplierResponse']
export type CreateSupplierRequest = Schemas['CreateSupplierRequest']
export type UpdateSupplierRequest = Schemas['UpdateSupplierRequest']
export type PurchaseOrder = Schemas['PurchaseOrderResponse']
export type PurchaseOrderStatus = NonNullable<PurchaseOrder['status']>
export type PurchaseOrderLine = Schemas['PurchaseOrderLineResponse']
export type PurchaseOrderLineRequest = Schemas['PurchaseOrderLineRequest']
export type CreatePurchaseOrderRequest = Schemas['CreatePurchaseOrderRequest']
export type UpdatePurchaseOrderRequest = Schemas['UpdatePurchaseOrderRequest']
export type GoodsReceipt = Schemas['GoodsReceiptResponse']
export type GoodsReceiptLine = Schemas['GoodsReceiptLineResponse']
export type PostGoodsReceiptRequest = Schemas['PostGoodsReceiptRequest']

export const PROCUREMENT_KEY = 'procurement'

interface PageParams {
  page: number
  size: number
}

// ---- Suppliers ------------------------------------------------------------------------

export interface SupplierListParams extends PageParams {
  active?: boolean
  search?: string
}

export function useSuppliersQuery(params: SupplierListParams) {
  return useQuery({
    queryKey: [PROCUREMENT_KEY, 'suppliers', 'list', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/suppliers', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              active: params.active,
              search: params.search || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useSupplierQuery(id: string) {
  return useQuery({
    queryKey: [PROCUREMENT_KEY, 'suppliers', 'detail', id],
    queryFn: () => unwrap(api.GET('/api/admin/suppliers/{id}', { params: { path: { id } } })),
  })
}

export function useCreateSupplierMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSupplierRequest) =>
      unwrap<Supplier>(api.POST('/api/admin/suppliers', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROCUREMENT_KEY, 'suppliers'] }),
  })
}

export function useUpdateSupplierMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateSupplierRequest) =>
      unwrap<Supplier>(api.PUT('/api/admin/suppliers/{id}', { params: { path: { id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROCUREMENT_KEY, 'suppliers'] }),
  })
}

export function useSupplierActiveMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: 'deactivate' | 'reactivate') =>
      unwrap<Supplier>(
        action === 'deactivate'
          ? api.POST('/api/admin/suppliers/{id}/deactivate', { params: { path: { id } } })
          : api.POST('/api/admin/suppliers/{id}/reactivate', { params: { path: { id } } })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROCUREMENT_KEY, 'suppliers'] }),
  })
}

// ---- Purchase orders ------------------------------------------------------------------

export interface PurchaseOrderListParams extends PageParams {
  status?: PurchaseOrderStatus
  supplierId?: string
  warehouseId?: string
  search?: string
  /** Inclusive business dates (YYYY-MM-DD, Asia/Kolkata). */
  expectedFrom?: string
  expectedTo?: string
}

export function usePurchaseOrdersQuery(params: PurchaseOrderListParams) {
  return useQuery({
    queryKey: [PROCUREMENT_KEY, 'pos', 'list', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/purchase-orders', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              status: params.status,
              supplierId: params.supplierId,
              warehouseId: params.warehouseId,
              search: params.search || undefined,
              expectedFrom: params.expectedFrom || undefined,
              expectedTo: params.expectedTo || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useOpenPurchaseOrdersQuery(
  params: PageParams & { supplierId?: string; warehouseId?: string }
) {
  return useQuery({
    queryKey: [PROCUREMENT_KEY, 'pos', 'open', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/purchase-orders/open', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              supplierId: params.supplierId,
              warehouseId: params.warehouseId,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function usePurchaseOrderQuery(id: string | undefined) {
  return useQuery({
    queryKey: [PROCUREMENT_KEY, 'pos', 'detail', id],
    queryFn: () =>
      unwrap(api.GET('/api/admin/purchase-orders/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  })
}

export function usePurchaseOrderReceiptsQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: [PROCUREMENT_KEY, 'pos', 'receipts', id],
    queryFn: () =>
      unwrap(api.GET('/api/admin/purchase-orders/{id}/receipts', { params: { path: { id } } })),
    enabled,
  })
}

export function useCreatePurchaseOrderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreatePurchaseOrderRequest) =>
      unwrap<PurchaseOrder>(api.POST('/api/admin/purchase-orders', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROCUREMENT_KEY, 'pos'] }),
  })
}

export function useUpdatePurchaseOrderMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdatePurchaseOrderRequest) =>
      unwrap<PurchaseOrder>(
        api.PUT('/api/admin/purchase-orders/{id}', { params: { path: { id } }, body })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROCUREMENT_KEY, 'pos'] }),
  })
}

export type PurchaseOrderAction = 'approve' | 'cancel'

export function usePurchaseOrderActionMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { action: PurchaseOrderAction; reason?: string }) =>
      unwrap<PurchaseOrder>(
        input.action === 'approve'
          ? api.POST('/api/admin/purchase-orders/{id}/approve', { params: { path: { id } } })
          : api.POST('/api/admin/purchase-orders/{id}/cancel', {
              params: { path: { id } },
              body: { reason: input.reason || undefined },
            })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROCUREMENT_KEY, 'pos'] }),
  })
}

// ---- Goods receipts -------------------------------------------------------------------

export interface GoodsReceiptListParams extends PageParams {
  purchaseOrderId?: string
  warehouseId?: string
  search?: string
}

export function useGoodsReceiptsQuery(params: GoodsReceiptListParams) {
  return useQuery({
    queryKey: [PROCUREMENT_KEY, 'grns', 'list', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/goods-receipts', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              purchaseOrderId: params.purchaseOrderId,
              warehouseId: params.warehouseId,
              search: params.search || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useGoodsReceiptQuery(id: string) {
  return useQuery({
    queryKey: [PROCUREMENT_KEY, 'grns', 'detail', id],
    queryFn: () => unwrap(api.GET('/api/admin/goods-receipts/{id}', { params: { path: { id } } })),
  })
}

export interface PostGoodsReceiptInput {
  /** One per attempt. A refusal the server answered mints a fresh one; a network failure keeps it. */
  idempotencyKey: string
  purchaseOrderId: string
  body: PostGoodsReceiptRequest
}

export function usePostGoodsReceiptMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ idempotencyKey, purchaseOrderId, body }: PostGoodsReceiptInput) =>
      unwrap<GoodsReceipt>(
        api.POST('/api/admin/goods-receipts', {
          params: { query: { purchaseOrderId }, header: { 'Idempotency-Key': idempotencyKey } },
          body,
        })
      ),
    // A receipt moves stock and the PO's received figures, and a mid-post failure may have done
    // both for some lines: refresh either way, so the admin sees what was actually received.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [PROCUREMENT_KEY] })
      void queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] })
    },
  })
}
