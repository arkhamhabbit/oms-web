import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type Product = components['schemas']['ProductResponse']
export type ProductStatus = NonNullable<Product['status']>
export type ProductAudience = NonNullable<Product['audience']>
export type ProductListingVisibility = NonNullable<Product['listingVisibility']>
export type ProductLockedDisplay = NonNullable<Product['lockedDisplay']>
export type ProductDetail = components['schemas']['ProductDetailResponse']
export type ProductCategory = components['schemas']['ProductCategoryResponse']
export type ProductOption = components['schemas']['ProductOptionResponse']
export type Variant = components['schemas']['VariantResponse']
export type VariantStatus = NonNullable<Variant['variantStatus']>
export type ProductImage = components['schemas']['ImageResponse']
export type ResolvedImage = components['schemas']['ResolvedImageResponse']
export type SpecValue = components['schemas']['SpecValueResponse']
export type VariantOptionValueResponse = components['schemas']['VariantOptionValueResponse']
export type OptionValuePayload = components['schemas']['OptionValuePayload']

type CreateProductRequest = components['schemas']['CreateProductRequest']
type UpdateProductRequest = components['schemas']['UpdateProductRequest']
type SetCategoriesRequest = components['schemas']['SetCategoriesRequest']
type AddOptionRequest = components['schemas']['AddOptionRequest']
type ReorderRequest = components['schemas']['ReorderRequest']
type CreateVariantRequest = components['schemas']['CreateVariantRequest']
type UpdateVariantRequest = components['schemas']['UpdateVariantRequest']
type AddImageRequest = components['schemas']['AddImageRequest']
type SetSpecRequest = components['schemas']['SetSpecRequest']

const PRODUCTS_KEY = 'products'

export interface ProductListParams {
  page: number
  size: number
  status?: ProductStatus
  live?: boolean
  brandId?: string
  categoryId?: string
  audience?: ProductAudience
  /**
   * Sent as the contract's single `search` param. **Contract gap** (flagged in the task's Status
   * block): the OpenAPI description for this endpoint says only "the whole catalog by name" —
   * there is no dedicated `sku` query param, and this session could not obtain an authenticated
   * session against the running OMS to confirm by direct experiment whether `search` also matches
   * a variant's `skuCode` server-side. This is sent through unconditionally on the assumption that
   * it does (a warehouse/support operator's most common lookup) — if it doesn't, SKU search
   * silently returns nothing rather than erroring, which is exactly the kind of gap D1.7 asks to
   * be raised rather than papered over.
   */
  search?: string
}

export const productsQueryKey = (params: ProductListParams) => [PRODUCTS_KEY, params] as const
export const productQueryKey = (id: string | undefined) => [PRODUCTS_KEY, 'detail', id] as const
export const productOptionsQueryKey = (productId: string | undefined) =>
  [PRODUCTS_KEY, 'options', productId] as const
export const productVariantsQueryKey = (productId: string | undefined) =>
  [PRODUCTS_KEY, 'variants', productId] as const
export const productImagesQueryKey = (productId: string | undefined) =>
  [PRODUCTS_KEY, 'images', productId] as const
export const variantImagesQueryKey = (productId: string | undefined, variantId: string | undefined) =>
  [PRODUCTS_KEY, 'variant-images', productId, variantId] as const
export const productSpecsQueryKey = (productId: string | undefined) =>
  [PRODUCTS_KEY, 'specs', productId] as const
export const variantSpecsQueryKey = (productId: string | undefined, variantId: string | undefined) =>
  [PRODUCTS_KEY, 'variant-specs', productId, variantId] as const

function useInvalidateProducts() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
}

// ---- Products ---------------------------------------------------------------------------

export function useProductsQuery(params: ProductListParams) {
  return useQuery({
    queryKey: productsQueryKey(params),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/products', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              status: params.status,
              live: params.live,
              brandId: params.brandId,
              categoryId: params.categoryId,
              audience: params.audience,
              search: params.search || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useProductQuery(id: string | undefined) {
  return useQuery({
    queryKey: productQueryKey(id),
    queryFn: () => unwrap(api.GET('/api/admin/products/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  })
}

export function useCreateProductMutation() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: (body: CreateProductRequest) =>
      unwrap<Product>(api.POST('/api/admin/products', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateProductMutation(id: string) {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: (body: UpdateProductRequest) =>
      unwrap<Product>(api.PUT('/api/admin/products/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  })
}

export function useSetCategoriesMutation(id: string) {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: (body: SetCategoriesRequest) =>
      unwrap<ProductCategory[]>(
        api.PUT('/api/admin/products/{id}/categories', { params: { path: { id } }, body })
      ),
    onSuccess: invalidate,
  })
}

function useProductTransitionMutation(
  id: string,
  action: 'submit' | 'approve' | 'reject' | 'publish' | 'unpublish' | 'archive'
) {
  const invalidate = useInvalidateProducts()
  const path = {
    submit: '/api/admin/products/{id}/submit',
    approve: '/api/admin/products/{id}/approve',
    reject: '/api/admin/products/{id}/reject',
    publish: '/api/admin/products/{id}/publish',
    unpublish: '/api/admin/products/{id}/unpublish',
    archive: '/api/admin/products/{id}/archive',
  }[action] as
    | '/api/admin/products/{id}/submit'
    | '/api/admin/products/{id}/approve'
    | '/api/admin/products/{id}/reject'
    | '/api/admin/products/{id}/publish'
    | '/api/admin/products/{id}/unpublish'
    | '/api/admin/products/{id}/archive'

  return useMutation({
    mutationFn: () => unwrap<Product>(api.POST(path, { params: { path: { id } } })),
    onSuccess: invalidate,
  })
}

export const useSubmitProductMutation = (id: string) => useProductTransitionMutation(id, 'submit')
export const useApproveProductMutation = (id: string) => useProductTransitionMutation(id, 'approve')
export const useRejectProductMutation = (id: string) => useProductTransitionMutation(id, 'reject')
export const usePublishProductMutation = (id: string) => useProductTransitionMutation(id, 'publish')
export const useUnpublishProductMutation = (id: string) =>
  useProductTransitionMutation(id, 'unpublish')
export const useArchiveProductMutation = (id: string) => useProductTransitionMutation(id, 'archive')

// ---- Options ------------------------------------------------------------------------------

export function useProductOptionsQuery(productId: string | undefined) {
  return useQuery({
    queryKey: productOptionsQueryKey(productId),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/products/{productId}/options', {
          params: { path: { productId: productId! } },
        })
      ),
    enabled: !!productId,
  })
}

function useInvalidateProduct(productId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
    queryClient.invalidateQueries({ queryKey: productQueryKey(productId) })
  }
}

export function useAddOptionMutation(productId: string) {
  const invalidate = useInvalidateProduct(productId)
  return useMutation({
    mutationFn: (body: AddOptionRequest) =>
      unwrap<ProductOption>(
        api.POST('/api/admin/products/{productId}/options', {
          params: { path: { productId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useRemoveOptionMutation(productId: string) {
  const invalidate = useInvalidateProduct(productId)
  return useMutation({
    mutationFn: (attributeId: string) =>
      unwrap<ProductOption[]>(
        api.DELETE('/api/admin/products/{productId}/options/{attributeId}', {
          params: { path: { productId, attributeId } },
        })
      ),
    onSuccess: invalidate,
  })
}

export function useReorderOptionsMutation(productId: string) {
  const invalidate = useInvalidateProduct(productId)
  return useMutation({
    mutationFn: (body: ReorderRequest) =>
      unwrap<ProductOption[]>(
        api.POST('/api/admin/products/{productId}/options/reorder', {
          params: { path: { productId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

// ---- Variants -----------------------------------------------------------------------------

export function useVariantsQuery(productId: string | undefined) {
  return useQuery({
    queryKey: productVariantsQueryKey(productId),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/products/{productId}/variants', {
          params: { path: { productId: productId! } },
        })
      ),
    enabled: !!productId,
  })
}

export function useCreateVariantMutation(productId: string) {
  const invalidate = useInvalidateProduct(productId)
  return useMutation({
    mutationFn: (body: CreateVariantRequest) =>
      unwrap<Variant>(
        api.POST('/api/admin/products/{productId}/variants', {
          params: { path: { productId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateVariantMutation(productId: string, variantId: string) {
  const invalidate = useInvalidateProduct(productId)
  return useMutation({
    mutationFn: (body: UpdateVariantRequest) =>
      unwrap<Variant>(
        api.PUT('/api/admin/products/{productId}/variants/{variantId}', {
          params: { path: { productId, variantId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

function useVariantActionMutation(
  productId: string,
  variantId: string,
  action: 'default' | 'discontinue' | 'reinstate'
) {
  const invalidate = useInvalidateProduct(productId)
  const path = {
    default: '/api/admin/products/{productId}/variants/{variantId}/default',
    discontinue: '/api/admin/products/{productId}/variants/{variantId}/discontinue',
    reinstate: '/api/admin/products/{productId}/variants/{variantId}/reinstate',
  }[action] as
    | '/api/admin/products/{productId}/variants/{variantId}/default'
    | '/api/admin/products/{productId}/variants/{variantId}/discontinue'
    | '/api/admin/products/{productId}/variants/{variantId}/reinstate'

  return useMutation({
    mutationFn: () => unwrap<Variant>(api.POST(path, { params: { path: { productId, variantId } } })),
    onSuccess: invalidate,
  })
}

export const useMakeVariantDefaultMutation = (productId: string, variantId: string) =>
  useVariantActionMutation(productId, variantId, 'default')
export const useDiscontinueVariantMutation = (productId: string, variantId: string) =>
  useVariantActionMutation(productId, variantId, 'discontinue')
export const useReinstateVariantMutation = (productId: string, variantId: string) =>
  useVariantActionMutation(productId, variantId, 'reinstate')

export function useReorderVariantsMutation(productId: string) {
  const invalidate = useInvalidateProduct(productId)
  return useMutation({
    mutationFn: (body: ReorderRequest) =>
      unwrap<Variant[]>(
        api.POST('/api/admin/products/{productId}/variants/reorder', {
          params: { path: { productId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

// ---- Images ---------------------------------------------------------------------------------

export function useProductImagesQuery(productId: string | undefined) {
  return useQuery({
    queryKey: productImagesQueryKey(productId),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/products/{productId}/images', {
          params: { path: { productId: productId! } },
        })
      ),
    enabled: !!productId,
  })
}

function useInvalidateProductImages(productId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, 'images', productId] }).then(() =>
      // A variant with no images of its own inherits the product's (D4.14) — its resolved images
      // must refresh too whenever the product's change.
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, 'variant-images'] })
    )
}

export function useAddProductImageMutation(productId: string) {
  const invalidate = useInvalidateProductImages(productId)
  return useMutation({
    mutationFn: (body: AddImageRequest) =>
      unwrap<ProductImage>(
        api.POST('/api/admin/products/{productId}/images', {
          params: { path: { productId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateProductImageMutation(productId: string) {
  const invalidate = useInvalidateProductImages(productId)
  return useMutation({
    mutationFn: ({ imageId, ...body }: AddImageRequest & { imageId: string; version: number }) =>
      unwrap<ProductImage>(
        api.PUT('/api/admin/products/{productId}/images/{imageId}', {
          params: { path: { productId, imageId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useRemoveProductImageMutation(productId: string) {
  const invalidate = useInvalidateProductImages(productId)
  return useMutation({
    mutationFn: (imageId: string) =>
      unwrap<void>(
        api.DELETE('/api/admin/products/{productId}/images/{imageId}', {
          params: { path: { productId, imageId } },
        })
      ),
    onSuccess: invalidate,
  })
}

export function useReorderProductImagesMutation(productId: string) {
  const invalidate = useInvalidateProductImages(productId)
  return useMutation({
    mutationFn: (body: ReorderRequest) =>
      unwrap<ProductImage[]>(
        api.POST('/api/admin/products/{productId}/images/reorder', {
          params: { path: { productId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useVariantImagesQuery(productId: string | undefined, variantId: string | undefined) {
  return useQuery({
    queryKey: variantImagesQueryKey(productId, variantId),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/products/{productId}/variants/{variantId}/images', {
          params: { path: { productId: productId!, variantId: variantId! } },
        })
      ),
    enabled: !!productId && !!variantId,
  })
}

function useInvalidateVariantImages(productId: string, variantId: string) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: variantImagesQueryKey(productId, variantId) })
}

export function useAddVariantImageMutation(productId: string, variantId: string) {
  const invalidate = useInvalidateVariantImages(productId, variantId)
  return useMutation({
    mutationFn: (body: AddImageRequest) =>
      unwrap<ProductImage>(
        api.POST('/api/admin/products/{productId}/variants/{variantId}/images', {
          params: { path: { productId, variantId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateVariantImageMutation(productId: string, variantId: string) {
  const invalidate = useInvalidateVariantImages(productId, variantId)
  return useMutation({
    mutationFn: ({ imageId, ...body }: AddImageRequest & { imageId: string; version: number }) =>
      unwrap<ProductImage>(
        api.PUT('/api/admin/products/{productId}/variants/{variantId}/images/{imageId}', {
          params: { path: { productId, variantId, imageId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useRemoveVariantImageMutation(productId: string, variantId: string) {
  const invalidate = useInvalidateVariantImages(productId, variantId)
  return useMutation({
    mutationFn: (imageId: string) =>
      unwrap<void>(
        api.DELETE('/api/admin/products/{productId}/variants/{variantId}/images/{imageId}', {
          params: { path: { productId, variantId, imageId } },
        })
      ),
    onSuccess: invalidate,
  })
}

export function useReorderVariantImagesMutation(productId: string, variantId: string) {
  const invalidate = useInvalidateVariantImages(productId, variantId)
  return useMutation({
    mutationFn: (body: ReorderRequest) =>
      unwrap<ProductImage[]>(
        api.POST('/api/admin/products/{productId}/variants/{variantId}/images/reorder', {
          params: { path: { productId, variantId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

// ---- Specs ----------------------------------------------------------------------------------

export function useProductSpecsQuery(productId: string | undefined) {
  return useQuery({
    queryKey: productSpecsQueryKey(productId),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/products/{productId}/specs', {
          params: { path: { productId: productId! } },
        })
      ),
    enabled: !!productId,
  })
}

export function useSetProductSpecMutation(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: SetSpecRequest) =>
      unwrap<SpecValue>(
        api.PUT('/api/admin/products/{productId}/specs', { params: { path: { productId } }, body })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: productSpecsQueryKey(productId) }),
  })
}

export function useClearProductSpecMutation(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (attributeId: string) =>
      unwrap<void>(
        api.DELETE('/api/admin/products/{productId}/specs/{attributeId}', {
          params: { path: { productId, attributeId } },
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: productSpecsQueryKey(productId) }),
  })
}

export function useVariantSpecsQuery(productId: string | undefined, variantId: string | undefined) {
  return useQuery({
    queryKey: variantSpecsQueryKey(productId, variantId),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/products/{productId}/variants/{variantId}/specs', {
          params: { path: { productId: productId!, variantId: variantId! } },
        })
      ),
    enabled: !!productId && !!variantId,
  })
}

export function useSetVariantSpecMutation(productId: string, variantId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: SetSpecRequest) =>
      unwrap<SpecValue>(
        api.PUT('/api/admin/products/{productId}/variants/{variantId}/specs', {
          params: { path: { productId, variantId } },
          body,
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: variantSpecsQueryKey(productId, variantId) }),
  })
}

export function useClearVariantSpecMutation(productId: string, variantId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (attributeId: string) =>
      unwrap<void>(
        api.DELETE('/api/admin/products/{productId}/variants/{variantId}/specs/{attributeId}', {
          params: { path: { productId, variantId, attributeId } },
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: variantSpecsQueryKey(productId, variantId) }),
  })
}
