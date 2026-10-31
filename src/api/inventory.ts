import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

type Schemas = components['schemas']

export type Warehouse = Schemas['WarehouseResponse']
export type WarehouseType = NonNullable<Warehouse['type']>
export type CreateWarehouseRequest = Schemas['CreateWarehouseRequest']
export type UpdateWarehouseRequest = Schemas['UpdateWarehouseRequest']
export type Batch = Schemas['BatchResponse']
export type CreateBatchRequest = Schemas['CreateBatchRequest']
export type StockTotal = Schemas['StockTotalResponse']
export type StockLevel = Schemas['StockLevelResponse']
export type ExpiringStock = Schemas['ExpiringStockResponse']
export type StockMovement = Schemas['StockMovementResponse']
export type MovementType = NonNullable<StockMovement['movementType']>
export type ReasonCode = NonNullable<StockMovement['reasonCode']>
export type AdjustStockRequest = Schemas['AdjustStockRequest']
export type TransferStockRequest = Schemas['TransferStockRequest']
export type Transfer = Schemas['TransferResponse']
export type ReasonPairing = Schemas['MovementTypeReasons']
export type DriftRow = Schemas['DriftRow']
export type ReconcileResult = Schemas['ReconcileResponse']
export type RebuildResult = Schemas['RebuildResponse']
export type AvailabilityReconcileResult = Schemas['AvailabilityReconcileResponse']

/** Every inventory query hangs off one key, so a stock write refreshes totals, levels and ledger together. */
export const INVENTORY_KEY = 'inventory'

interface PageParams {
  page: number
  size: number
}

// ---- Warehouses -----------------------------------------------------------------------

export interface WarehouseListParams extends PageParams {
  active?: boolean
  type?: WarehouseType
  search?: string
}

export function useWarehousesQuery(params: WarehouseListParams) {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'warehouses', 'list', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/warehouses', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              active: params.active,
              type: params.type,
              search: params.search || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useWarehouseQuery(id: string) {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'warehouses', 'detail', id],
    queryFn: () => unwrap(api.GET('/api/admin/warehouses/{id}', { params: { path: { id } } })),
  })
}

export function useCreateWarehouseMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateWarehouseRequest) =>
      unwrap<Warehouse>(api.POST('/api/admin/warehouses', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY, 'warehouses'] }),
  })
}

export function useUpdateWarehouseMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateWarehouseRequest) =>
      unwrap<Warehouse>(api.PUT('/api/admin/warehouses/{id}', { params: { path: { id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY, 'warehouses'] }),
  })
}

export function useWarehouseActiveMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: 'deactivate' | 'reactivate') =>
      unwrap<Warehouse>(
        action === 'deactivate'
          ? api.POST('/api/admin/warehouses/{id}/deactivate', { params: { path: { id } } })
          : api.POST('/api/admin/warehouses/{id}/reactivate', { params: { path: { id } } })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY, 'warehouses'] }),
  })
}

// ---- Batches --------------------------------------------------------------------------

export interface BatchListParams extends PageParams {
  variantId?: string
  expiringWithinDays?: number
  search?: string
}

export function useBatchesQuery(params: BatchListParams, enabled = true) {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'batches', 'list', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/batches', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              variantId: params.variantId,
              expiringWithinDays: params.expiringWithinDays,
              search: params.search || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
    enabled,
  })
}

export function useBatchQuery(id: string) {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'batches', 'detail', id],
    queryFn: () => unwrap(api.GET('/api/admin/batches/{id}', { params: { path: { id } } })),
  })
}

export function useCreateBatchMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateBatchRequest) =>
      unwrap<Batch>(api.POST('/api/admin/batches', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY, 'batches'] }),
  })
}

// ---- Stock ----------------------------------------------------------------------------

export function useStockTotalsQuery(params: PageParams & { variantId?: string; q?: string }) {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'totals', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/stock/totals', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              variantId: params.variantId,
              q: params.q || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export interface StockLevelParams extends PageParams {
  variantId?: string
  warehouseId?: string
  batchId?: string
  includeEmpty?: boolean
}

export function useStockLevelsQuery(params: StockLevelParams) {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'levels', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/stock/levels', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              variantId: params.variantId,
              warehouseId: params.warehouseId,
              batchId: params.batchId,
              includeEmpty: params.includeEmpty,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useLowStockQuery(
  params: PageParams & { threshold?: number; warehouseId?: string }
) {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'low-stock', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/stock/low-stock', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              threshold: params.threshold,
              warehouseId: params.warehouseId,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useExpiringSoonQuery(
  params: PageParams & { withinDays?: number; warehouseId?: string }
) {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'expiring-soon', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/stock/expiring-soon', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              withinDays: params.withinDays,
              warehouseId: params.warehouseId,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export interface MovementParams extends PageParams {
  variantId?: string
  warehouseId?: string
  batchId?: string
  movementType?: MovementType
  /** ISO instant, inclusive. */
  from?: string
  /** ISO instant, exclusive. */
  to?: string
  reason?: ReasonCode
  /** The contract names TRANSFER, PURCHASE_ORDER and RESERVATION; works alone or with the id. */
  referenceType?: string
  referenceId?: string
}

export function useStockMovementsQuery(params: MovementParams) {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'movements', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/stock/movements', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              variantId: params.variantId,
              warehouseId: params.warehouseId,
              batchId: params.batchId,
              movementType: params.movementType,
              from: params.from,
              to: params.to,
              reason: params.reason,
              referenceType: params.referenceType || undefined,
              referenceId: params.referenceId || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

/**
 * Which reasons each movement type takes, as the server publishes it. It changes only with a
 * release, so one read serves the whole session; an empty list means the type takes no reason.
 */
export function useReasonCodesQuery() {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'reason-codes'],
    queryFn: () => unwrap<ReasonPairing[]>(api.GET('/api/admin/stock/reason-codes')),
    staleTime: Infinity,
  })
}

export function reasonsForType(
  pairings: ReasonPairing[] | undefined,
  type: MovementType
): ReasonCode[] {
  return pairings?.find((p) => p.movementType === type)?.reasons ?? []
}

export function useTransferQuery(referenceId: string | undefined) {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'transfer', referenceId],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/stock/transfers/{referenceId}', {
          params: { path: { referenceId: referenceId! } },
        })
      ),
    enabled: !!referenceId,
  })
}

/** A read that is run on demand (the Reconcile tab's button), never on mount. */
export function useStockReconcileQuery() {
  return useQuery({
    queryKey: [INVENTORY_KEY, 'reconcile'],
    queryFn: () => unwrap(api.GET('/api/admin/stock/reconcile')),
    enabled: false,
  })
}

export function useRebuildProjectionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap<RebuildResult>(api.POST('/api/admin/stock/rebuild')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] }),
  })
}

export function useReconcileAvailabilityMutation() {
  return useMutation({
    mutationFn: () =>
      unwrap<AvailabilityReconcileResult>(api.POST('/api/admin/stock/availability/reconcile')),
  })
}

export interface AdjustStockInput {
  /** One per attempt: a resend of the same confirm is not a second movement. */
  idempotencyKey: string
  body: AdjustStockRequest
}

export function useAdjustStockMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ idempotencyKey, body }: AdjustStockInput) =>
      unwrap<StockMovement>(
        api.POST('/api/admin/stock/adjust', {
          params: { header: { 'Idempotency-Key': idempotencyKey } },
          body,
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] }),
  })
}

export interface TransferStockInput {
  idempotencyKey: string
  body: TransferStockRequest
}

export function useTransferStockMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ idempotencyKey, body }: TransferStockInput) =>
      unwrap<Transfer>(
        api.POST('/api/admin/stock/transfer', {
          params: { header: { 'Idempotency-Key': idempotencyKey } },
          body,
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] }),
  })
}
