import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

type Schemas = components['schemas']

export type OrderSummary = Schemas['OrderSummaryResponse']
export type OrderDetail = Schemas['OrderDetailResponse']
export type OrderLine = Schemas['OrderLineResponse']
export type OrderEvent = Schemas['OrderEventResponse']
export type OrderStatus = NonNullable<OrderDetail['status']>
export type OrderPayment = Schemas['PaymentResponse']
export type OrderSettings = Schemas['OrderSettingsResponse']
export type CancelUntil = NonNullable<OrderSettings['cancelUntil']>
export type PublishOrderSettingsRequest = Schemas['PublishOrderSettingsRequest']

const ORDERS_KEY = 'orders'

export interface OrderListParams {
  page: number
  size: number
  status?: OrderStatus
  number?: string
  consumerId?: string
  /** ISO instant, inclusive. */
  from?: string
  /** ISO instant, exclusive. */
  to?: string
}

export function useOrdersQuery(params: OrderListParams) {
  return useQuery({
    queryKey: [ORDERS_KEY, 'list', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/orders', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              status: params.status,
              number: params.number || undefined,
              consumerId: params.consumerId || undefined,
              from: params.from,
              to: params.to,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useOrderQuery(id: string) {
  return useQuery({
    queryKey: [ORDERS_KEY, 'detail', id],
    queryFn: () => unwrap(api.GET('/api/admin/orders/{id}', { params: { path: { id } } })),
  })
}

/** Every write carries a client-minted key (one per confirm dialog), so a resend is not a second action. */
export type FulfilAction = 'pack' | 'ship' | 'out-for-delivery' | 'deliver' | 'cancel' | 'refund'

export interface OrderActionInput {
  action: FulfilAction
  version: number
  idempotencyKey: string
  carrier?: string
  trackingReference?: string
  reason?: string
}

export function useOrderActionMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OrderActionInput) => {
      const base = {
        params: { path: { id }, header: { 'Idempotency-Key': input.idempotencyKey } },
      }
      switch (input.action) {
        case 'pack':
          return unwrap<OrderDetail>(
            api.POST('/api/admin/orders/{id}/pack', { ...base, body: { version: input.version } })
          )
        case 'out-for-delivery':
          return unwrap<OrderDetail>(
            api.POST('/api/admin/orders/{id}/out-for-delivery', {
              ...base,
              body: { version: input.version },
            })
          )
        case 'deliver':
          return unwrap<OrderDetail>(
            api.POST('/api/admin/orders/{id}/deliver', {
              ...base,
              body: { version: input.version },
            })
          )
        case 'ship':
          return unwrap<OrderDetail>(
            api.POST('/api/admin/orders/{id}/ship', {
              ...base,
              body: {
                version: input.version,
                carrier: input.carrier ?? '',
                trackingReference: input.trackingReference ?? '',
              },
            })
          )
        case 'cancel':
          return unwrap<OrderDetail>(
            api.POST('/api/admin/orders/{id}/cancel', {
              ...base,
              body: { version: input.version, reason: input.reason || undefined },
            })
          )
        case 'refund':
          return unwrap<OrderDetail>(
            api.POST('/api/admin/orders/{id}/refund', {
              ...base,
              body: { version: input.version, reason: input.reason || undefined },
            })
          )
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}

export interface RefundSettlementInput {
  action: 'retry' | 'mark-refunded'
  version: number
  idempotencyKey: string
  /** How a manual settlement was paid (mark-refunded only; required there). */
  reference?: string
  reason?: string
}

/**
 * D9.6 — the two admin actions on a refund the gateway keeps refusing: start a fresh round of
 * attempts, or record that the shopper was paid back outside the gateway. Both are idempotent per key.
 */
export function useRefundSettlementMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RefundSettlementInput) => {
      const base = {
        params: { path: { id }, header: { 'Idempotency-Key': input.idempotencyKey } },
      }
      return input.action === 'retry'
        ? unwrap<OrderDetail>(
            api.POST('/api/admin/orders/{id}/refund/retry', {
              ...base,
              body: { version: input.version },
            })
          )
        : unwrap<OrderDetail>(
            api.POST('/api/admin/orders/{id}/refund/mark-refunded', {
              ...base,
              body: {
                version: input.version,
                reference: input.reference ?? '',
                reason: input.reason || undefined,
              },
            })
          )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}

export function useCurrentOrderSettingsQuery() {
  return useQuery({
    queryKey: [ORDERS_KEY, 'settings', 'current'],
    queryFn: () => unwrap(api.GET('/api/admin/orders/settings')),
  })
}

export function useOrderSettingsVersionsQuery(page: number, size: number) {
  return useQuery({
    queryKey: [ORDERS_KEY, 'settings', 'versions', page, size],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/orders/settings/versions', {
          params: { query: { pageable: { page, size } } },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function usePublishOrderSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PublishOrderSettingsRequest) =>
      unwrap<OrderSettings>(api.POST('/api/admin/orders/settings/versions', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ORDERS_KEY, 'settings'] }),
  })
}
