import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

type Schemas = components['schemas']

/** Money on the wire (D3.2): integer minor units plus an ISO currency. */
export type Money = Schemas['MoneyPayload']

/**
 * **Contract defect (raised in the W2.1 Status block).** The pricing DTOs reference OMS's
 * internal `Money` class instead of `MoneyPayload`, so the contract publishes their money
 * fields as `{negative, positive, zero}` — the getters of the Java type — while every pricing
 * endpoint actually sends and accepts `{amountMinor, currency}` (observed against the running
 * OMS). This rewires exactly the contract's `Money` shape to `MoneyPayload`, which the contract
 * does describe, and leaves every other field as generated — so a field removed in OMS still
 * breaks this build (D2.15). Delete it once OMS publishes `MoneyPayload` on these DTOs.
 */
type ContractMoney = Schemas['Money']
type IsContractMoney<T> = [keyof T] extends [keyof ContractMoney]
  ? [keyof ContractMoney] extends [keyof T]
    ? true
    : false
  : false
type Rewire<T> = T extends readonly (infer U)[]
  ? Rewire<U>[]
  : T extends object
    ? IsContractMoney<T> extends true
      ? Money
      : { [K in keyof T]: Rewire<T[K]> }
    : T

/** The one place a wire `Money` is handed to a request typed with the defective shape. */
function toContractMoney(money: Money): ContractMoney {
  return money as unknown as ContractMoney
}

export type PricingVersion = Schemas['PricingVersionResponse']
export type PricingVersionState = NonNullable<PricingVersion['state']>
export type PricingVersionStatus = NonNullable<PricingVersion['status']>
export type LevelPrice = Rewire<Schemas['LevelPriceResponse']>
export type VariantPrices = Rewire<Schemas['VariantPricesResponse']>
export type PricingLevel = NonNullable<Schemas['LevelOverrideResponse']['level']>
export type PriceMatrix = Rewire<Schemas['PriceMatrixResponse']>
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
    queryFn: async () => {
      const data = await unwrap(
        api.GET('/api/admin/pricing/versions/{id}/prices', {
          params: { path: { id }, query: { pageable: { page, size } } },
        })
      )
      return data as Rewire<typeof data>
    },
    placeholderData: (previous) => previous,
  })
}

export function useVariantPricesQuery(versionId: string, variantId: string | undefined) {
  return useQuery({
    queryKey: [PRICING_KEY, 'variant-prices', versionId, variantId],
    enabled: !!variantId,
    queryFn: async () =>
      (await unwrap(
        api.GET('/api/admin/pricing/versions/{id}/variants/{variantId}/prices', {
          params: { path: { id: versionId, variantId: variantId! } },
        })
      )) as VariantPrices,
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
    queryFn: async () =>
      (await unwrap(
        api.GET('/api/admin/pricing/variants/{variantId}/matrix', {
          params: { path: { variantId: variantId! }, query: { at } },
        })
      )) as PriceMatrix,
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
    mutationFn: async ({
      prices,
      version,
    }: {
      prices: { level: PricingLevel; price: Money }[]
      version: number
    }) =>
      (await unwrap(
        api.PUT('/api/admin/pricing/versions/{id}/variants/{variantId}/prices', {
          params: { path: { id: versionId, variantId } },
          body: {
            version,
            prices: prices.map((p) => ({ level: p.level, price: toContractMoney(p.price) })),
          },
        })
      )) as VariantPrices,
    onSuccess: invalidate,
  })
}
