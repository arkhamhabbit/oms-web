import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

type Schemas = components['schemas']

/** Money on the wire (D3.2): integer minor units plus an ISO currency. */
export type Money = Schemas['MoneyPayload']

export type PricingVersion = Schemas['PricingVersionResponse']
export type PricingVersionState = NonNullable<PricingVersion['state']>
export type PricingVersionStatus = NonNullable<PricingVersion['status']>
export type LevelPrice = Schemas['LevelPriceResponse']
export type VariantPrices = Schemas['VariantPricesResponse']
export type PricingLevel = NonNullable<Schemas['LevelOverrideResponse']['level']>
export type PriceMatrix = Schemas['PriceMatrixResponse']
export type TierPrice = NonNullable<PriceMatrix['tiers']>[number]

type CreatePricingVersionRequest = Schemas['CreatePricingVersionRequest']
type UpdatePricingVersionRequest = Schemas['UpdatePricingVersionRequest']
type PublishPricingVersionRequest = Schemas['PublishPricingVersionRequest']

const PRICING_KEY = 'pricing'

export interface PricingVersionListParams {
  page: number
  size: number
  status?: PricingVersionStatus
}

export function usePricingVersionsQuery(params: PricingVersionListParams) {
  return useQuery({
    queryKey: [PRICING_KEY, 'versions', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/pricing/versions', {
          params: {
            query: { pageable: { page: params.page, size: params.size }, status: params.status },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function usePricingVersionQuery(id: string) {
  return useQuery({
    queryKey: [PRICING_KEY, 'version', id],
    queryFn: () =>
      unwrap(api.GET('/api/admin/pricing/versions/{id}', { params: { path: { id } } })),
  })
}

export function usePricingVersionPricesQuery(id: string, page: number, size: number) {
  return useQuery({
    queryKey: [PRICING_KEY, 'prices', id, page, size],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/pricing/versions/{id}/prices', {
          params: { path: { id }, query: { pageable: { page, size } } },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useVariantPricesQuery(versionId: string, variantId: string | undefined) {
  return useQuery({
    queryKey: [PRICING_KEY, 'variant-prices', versionId, variantId],
    enabled: !!variantId,
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/pricing/versions/{id}/variants/{variantId}/prices', {
          params: { path: { id: versionId, variantId: variantId! } },
        })
      ),
  })
}

/**
 * A variant's price for every tier at `at` (default now) — what resolution actually charges,
 * including a price capped at a base the catalog has since lowered (D7.12).
 */
export function usePriceMatrixQuery(variantId: string | undefined, at?: string) {
  return useQuery({
    queryKey: [PRICING_KEY, 'matrix', variantId, at ?? 'now'],
    enabled: !!variantId,
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/pricing/variants/{variantId}/matrix', {
          params: { path: { variantId: variantId! }, query: { at } },
        })
      ),
  })
}

function useInvalidatePricing() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [PRICING_KEY] })
}

export function useCreatePricingVersionMutation() {
  const invalidate = useInvalidatePricing()
  return useMutation({
    mutationFn: (body: CreatePricingVersionRequest) =>
      unwrap<PricingVersion>(api.POST('/api/admin/pricing/versions', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdatePricingVersionMutation(id: string) {
  const invalidate = useInvalidatePricing()
  return useMutation({
    mutationFn: (body: UpdatePricingVersionRequest) =>
      unwrap<PricingVersion>(
        api.PUT('/api/admin/pricing/versions/{id}', { params: { path: { id } }, body })
      ),
    onSuccess: invalidate,
  })
}

export function usePublishPricingVersionMutation(id: string) {
  const invalidate = useInvalidatePricing()
  return useMutation({
    mutationFn: (body: PublishPricingVersionRequest) =>
      unwrap<PricingVersion>(
        api.POST('/api/admin/pricing/versions/{id}/publish', { params: { path: { id } }, body })
      ),
    onSuccess: invalidate,
  })
}

export function useWithdrawPricingVersionMutation(id: string) {
  const invalidate = useInvalidatePricing()
  return useMutation({
    mutationFn: (version: number) =>
      unwrap<PricingVersion>(
        api.POST('/api/admin/pricing/versions/{id}/withdraw', {
          params: { path: { id } },
          body: { version },
        })
      ),
    onSuccess: invalidate,
  })
}

/**
 * Replaces a variant's prices in a draft in one write — a level left out is cleared and pays the
 * base selling price. Every price edit moves the draft's `version`, so the whole `pricing` cache
 * is invalidated: the version header, its price list and any open editor all carry it.
 */
export function useSetVariantPricesMutation(versionId: string, variantId: string) {
  const invalidate = useInvalidatePricing()
  return useMutation({
    mutationFn: ({
      prices,
      version,
    }: {
      prices: { level: PricingLevel; price: Money }[]
      version: number
    }) =>
      unwrap(
        api.PUT('/api/admin/pricing/versions/{id}/variants/{variantId}/prices', {
          params: { path: { id: versionId, variantId } },
          body: { version, prices },
        })
      ),
    onSuccess: invalidate,
  })
}

export type TierBitsOption = Schemas['TierBitsOptionResponse']
export type BitsOption = Schemas['BitsOptionResponse']
export type BitsSource = NonNullable<TierPrice['bitsSource']>

/**
 * Replaces a variant's Bits options in a draft in one write — a tier left out is cleared and has
 * no Bits option. Like a price edit it moves the draft's `version`, so the whole `pricing` cache
 * is invalidated.
 */
export function useSetVariantBitsOptionsMutation(versionId: string, variantId: string) {
  const invalidate = useInvalidatePricing()
  return useMutation({
    mutationFn: ({
      bitsOptions,
      version,
    }: {
      bitsOptions: Schemas['TierBitsOptionRequest'][]
      version: number
    }) =>
      unwrap(
        api.PUT('/api/admin/pricing/versions/{id}/variants/{variantId}/bits-options', {
          params: { path: { id: versionId, variantId } },
          body: { version, bitsOptions },
        })
      ),
    onSuccess: invalidate,
  })
}

/** The per-order Bits cap has its own endpoint, so a header edit can never clear it silently. */
export function useSetMaxPointsPerOrderMutation(id: string) {
  const invalidate = useInvalidatePricing()
  return useMutation({
    mutationFn: (body: Schemas['SetMaxPointsPerOrderRequest']) =>
      unwrap<PricingVersion>(
        api.PUT('/api/admin/pricing/versions/{id}/max-points-per-order', {
          params: { path: { id } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}
