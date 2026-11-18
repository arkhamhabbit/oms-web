import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

type Schemas = components['schemas']

export type ShipmentSummary = Schemas['ShipmentSummaryResponse']
export type ShipmentDetail = Schemas['ShipmentDetailResponse']
export type ShipmentEvent = Schemas['ShipmentEventResponse']
export type ShipmentStatus = NonNullable<ShipmentSummary['status']>
export type OrderShipment = Schemas['OrderShipmentResponse']
export type BookOrder = Schemas['BookOrderRequest']
export type BookShipmentsRequest = Schemas['BookShipmentsRequest']
export type BookShipmentsResult = Schemas['BookShipmentsResponse']
export type BookAndPrintResult = Schemas['BookAndPrintResponse']
export type BookingResult = Schemas['BookingResultResponse']
export type BookingPreviews = Schemas['BookingPreviewsResponse']
export type BookingPreview = Schemas['BookingPreviewResponse']
export type LabelFile = Schemas['LabelFileResponse']
export type ShippingCallSummary = Schemas['ShippingCallSummaryResponse']
export type ShippingCall = Schemas['ShippingCallResponse']
export type ShippingCallAction = NonNullable<ShippingCallSummary['action']>
export type ShippingProvider = Schemas['ShippingProviderResponse']
export type ProviderTest = Schemas['ProviderTestResponse']
export type ShippingSettings = Schemas['ShippingSettingsResponse']
export type PublishShippingSettingsRequest = Schemas['PublishShippingSettingsRequest']

const SHIPPING_KEY = 'shipping'
const ORDERS_KEY = 'orders'

/** Booking, cancelling or printing moves orders as well as shipments: both caches are refreshed. */
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [SHIPPING_KEY] }),
    queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  ])
}

// --- shipments -------------------------------------------------------------------------------

export function useShipmentQuery(id: string | undefined, enabled = true) {
  return useQuery({
    enabled: enabled && !!id,
    queryKey: [SHIPPING_KEY, 'shipment', id],
    queryFn: () =>
      unwrap(api.GET('/api/admin/shipments/{id}', { params: { path: { id: id! } } })),
  })
}

/**
 * What booking these orders would send, with this provider (or the settings' default when none is
 * given). Read-only: no provider is called, nothing is written or logged (OMS 2.11).
 */
export function useBookingPreviewQuery(orderNumbers: string[], providerCode?: string, enabled = true) {
  return useQuery({
    enabled: enabled && orderNumbers.length > 0,
    queryKey: [SHIPPING_KEY, 'preview', orderNumbers, providerCode ?? null],
    staleTime: 0,
    queryFn: () =>
      unwrap<BookingPreviews>(
        api.POST('/api/admin/shipments/preview', {
          body: { orderNumbers, providerCode },
        })
      ),
  })
}

export function useBookShipmentsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { body: BookShipmentsRequest; idempotencyKey: string }) =>
      unwrap<BookShipmentsResult>(
        api.POST('/api/admin/shipments/book', {
          params: { header: { 'Idempotency-Key': input.idempotencyKey } },
          body: input.body,
        })
      ),
    onSuccess: () => invalidateAll(queryClient),
  })
}

export function useBookAndPrintMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { body: BookShipmentsRequest; idempotencyKey: string }) =>
      unwrap<BookAndPrintResult>(
        api.POST('/api/admin/shipments/book-and-print', {
          params: { header: { 'Idempotency-Key': input.idempotencyKey } },
          body: input.body,
        })
      ),
    onSuccess: () => invalidateAll(queryClient),
  })
}

/**
 * One merged PDF of up to twenty labels, all or nothing: a refusal (422) names the order whose
 * label could not be fetched and nothing is marked printed.
 */
export function usePrintLabelsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: { orderNumbers: string[] } | { shipmentIds: string[] }) =>
      unwrap<Blob>(
        api.POST('/api/admin/shipments/labels', {
          body: target,
          parseAs: 'blob',
        }) as Promise<{ data?: Blob; error?: Schemas['ErrorResponse']; response: Response }>
      ),
    onSuccess: () => invalidateAll(queryClient),
  })
}

export function useCancelShipmentMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { version: number; reason?: string; idempotencyKey: string }) =>
      unwrap<ShipmentDetail>(
        api.POST('/api/admin/shipments/{id}/cancel', {
          params: { path: { id }, header: { 'Idempotency-Key': input.idempotencyKey } },
          body: { version: input.version, reason: input.reason || undefined },
        })
      ),
    onSuccess: () => invalidateAll(queryClient),
  })
}

export function useRefreshShipmentMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (idempotencyKey: string) =>
      unwrap<ShipmentDetail>(
        api.POST('/api/admin/shipments/{id}/refresh', {
          params: { path: { id }, header: { 'Idempotency-Key': idempotencyKey } },
        })
      ),
    onSuccess: () => invalidateAll(queryClient),
  })
}

// --- the shipping log ------------------------------------------------------------------------

export interface ShippingCallListParams {
  page: number
  size: number
  provider?: string
  action?: ShippingCallAction
  success?: boolean
  orderNumber?: string
  awb?: string
  shipmentId?: string
  from?: string
  to?: string
}

export function useShippingCallsQuery(params: ShippingCallListParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [SHIPPING_KEY, 'calls', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/shipping/calls', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              provider: params.provider || undefined,
              action: params.action,
              success: params.success,
              orderNumber: params.orderNumber || undefined,
              awb: params.awb || undefined,
              shipmentId: params.shipmentId,
              from: params.from,
              to: params.to,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useShippingCallQuery(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [SHIPPING_KEY, 'call', id],
    queryFn: () =>
      unwrap(api.GET('/api/admin/shipping/calls/{id}', { params: { path: { id: id! } } })),
  })
}

// --- providers and settings ------------------------------------------------------------------

export function useShippingProvidersQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: [SHIPPING_KEY, 'providers'],
    queryFn: () => unwrap<ShippingProvider[]>(api.GET('/api/admin/shipping/providers')),
  })
}

export function useTestProviderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      unwrap<ProviderTest>(
        api.POST('/api/admin/shipping/providers/{code}/test', { params: { path: { code } } })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SHIPPING_KEY, 'calls'] }),
  })
}

export function useCurrentShippingSettingsQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: [SHIPPING_KEY, 'settings', 'current'],
    queryFn: () => unwrap(api.GET('/api/admin/shipping/settings')),
  })
}

export function useShippingSettingsVersionsQuery(page: number, size: number) {
  return useQuery({
    queryKey: [SHIPPING_KEY, 'settings', 'versions', page, size],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/shipping/settings/versions', {
          params: { query: { pageable: { page, size } } },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function usePublishShippingSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PublishShippingSettingsRequest) =>
      unwrap<ShippingSettings>(api.POST('/api/admin/shipping/settings/versions', { body })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [SHIPPING_KEY, 'settings'] }),
        queryClient.invalidateQueries({ queryKey: [SHIPPING_KEY, 'providers'] }),
      ]),
  })
}
