import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type Tag = components['schemas']['TagResponse']
export type ProductMerchandising = components['schemas']['ProductMerchandisingResponse']
export type VariantMerchandising = components['schemas']['VariantMerchandisingResponse']
type UpdateProductMerchandisingRequest = components['schemas']['UpdateProductMerchandisingRequest']
type UpdateVariantMerchandisingRequest = components['schemas']['UpdateVariantMerchandisingRequest']

const TAGS_KEY = 'tags'
const MERCH_KEY = 'merchandising'

export function useTagsQuery() {
  return useQuery({
    queryKey: [TAGS_KEY],
    queryFn: () => unwrap<Tag[]>(api.GET('/api/admin/tags')),
  })
}

function useInvalidateTags() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [TAGS_KEY] }),
      // A renamed tag shows its new label wherever it is applied.
      queryClient.invalidateQueries({ queryKey: [MERCH_KEY] }),
    ])
}

export function useCreateTagMutation() {
  const invalidate = useInvalidateTags()
  return useMutation({
    mutationFn: (body: components['schemas']['CreateTagRequest']) =>
      unwrap<Tag>(api.POST('/api/admin/tags', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateTagMutation() {
  const invalidate = useInvalidateTags()
  return useMutation({
    mutationFn: ({ id, ...body }: components['schemas']['UpdateTagRequest'] & { id: string }) =>
      unwrap<Tag>(api.PUT('/api/admin/tags/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  })
}

export function useDeleteTagMutation() {
  const invalidate = useInvalidateTags()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<void>(api.DELETE('/api/admin/tags/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  })
}

export const productMerchandisingKey = (productId: string | undefined) =>
  [MERCH_KEY, 'product', productId] as const
export const variantMerchandisingKey = (
  productId: string | undefined,
  variantId: string | undefined
) => [MERCH_KEY, 'variant', productId, variantId] as const

export function useProductMerchandisingQuery(productId: string | undefined) {
  return useQuery({
    queryKey: productMerchandisingKey(productId),
    queryFn: () =>
      unwrap<ProductMerchandising>(
        api.GET('/api/admin/products/{productId}/merchandising', {
          params: { path: { productId: productId! } },
        })
      ),
    enabled: !!productId,
  })
}

export function useVariantMerchandisingQuery(
  productId: string | undefined,
  variantId: string | undefined
) {
  return useQuery({
    queryKey: variantMerchandisingKey(productId, variantId),
    queryFn: () =>
      unwrap<VariantMerchandising>(
        api.GET('/api/admin/products/{productId}/variants/{variantId}/merchandising', {
          params: { path: { productId: productId!, variantId: variantId! } },
        })
      ),
    enabled: !!productId && !!variantId,
  })
}

/**
 * The merchandising edits bump the product's or variant's `version` (even a tag-only edit), so
 * the product queries — which carry those versions to every other tab's forms — refresh too.
 */
function useInvalidateMerchandising() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [MERCH_KEY] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
    ])
}

export function useUpdateProductMerchandisingMutation(productId: string) {
  const invalidate = useInvalidateMerchandising()
  return useMutation({
    mutationFn: (body: UpdateProductMerchandisingRequest) =>
      unwrap<ProductMerchandising>(
        api.PUT('/api/admin/products/{productId}/merchandising', {
          params: { path: { productId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateVariantMerchandisingMutation(productId: string, variantId: string) {
  const invalidate = useInvalidateMerchandising()
  return useMutation({
    mutationFn: (body: UpdateVariantMerchandisingRequest) =>
      unwrap<VariantMerchandising>(
        api.PUT('/api/admin/products/{productId}/variants/{variantId}/merchandising', {
          params: { path: { productId, variantId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}
