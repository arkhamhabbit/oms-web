import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type ContentBlock = components['schemas']['BlockResponse']
export type ContentSlide = components['schemas']['SlideResponse']
export type BlockFormat = NonNullable<ContentBlock['format']>
type CreateBlockRequest = components['schemas']['CreateBlockRequest']
type UpdateBlockRequest = components['schemas']['UpdateBlockRequest']
type AddSlideRequest = components['schemas']['AddSlideRequest']
type UpdateSlideRequest = components['schemas']['UpdateSlideRequest']

const CONTENT_KEY = 'product-content'

export const productContentQueryKey = (productId: string | undefined) =>
  [CONTENT_KEY, productId] as const

export function useProductContentQuery(productId: string | undefined) {
  return useQuery({
    queryKey: productContentQueryKey(productId),
    queryFn: () =>
      unwrap<components['schemas']['ProductContentResponse']>(
        api.GET('/api/admin/products/{productId}/content', {
          params: { path: { productId: productId! } },
        })
      ),
    enabled: !!productId,
  })
}

/** Every content write changes the same document, so every write refreshes the one query. */
function useInvalidateContent(productId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: productContentQueryKey(productId) })
}

export function useCreateBlockMutation(productId: string) {
  const invalidate = useInvalidateContent(productId)
  return useMutation({
    mutationFn: (body: CreateBlockRequest) =>
      unwrap<ContentBlock>(
        api.POST('/api/admin/products/{productId}/content/blocks', {
          params: { path: { productId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateBlockMutation(productId: string) {
  const invalidate = useInvalidateContent(productId)
  return useMutation({
    mutationFn: ({ blockId, ...body }: UpdateBlockRequest & { blockId: string }) =>
      unwrap<ContentBlock>(
        api.PUT('/api/admin/products/{productId}/content/blocks/{blockId}', {
          params: { path: { productId, blockId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteBlockMutation(productId: string) {
  const invalidate = useInvalidateContent(productId)
  return useMutation({
    mutationFn: (blockId: string) =>
      unwrap<void>(
        api.DELETE('/api/admin/products/{productId}/content/blocks/{blockId}', {
          params: { path: { productId, blockId } },
        })
      ),
    onSuccess: invalidate,
  })
}

/** Whole-set reorder (D4.20): every block id, in the new order. */
export function useReorderBlocksMutation(productId: string) {
  const invalidate = useInvalidateContent(productId)
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      unwrap<unknown>(
        api.POST('/api/admin/products/{productId}/content/blocks/reorder', {
          params: { path: { productId } },
          body: { orderedIds },
        })
      ),
    onSuccess: invalidate,
  })
}

export function useAddSlideMutation(productId: string, blockId: string) {
  const invalidate = useInvalidateContent(productId)
  return useMutation({
    mutationFn: (body: AddSlideRequest) =>
      unwrap<ContentSlide>(
        api.POST('/api/admin/products/{productId}/content/blocks/{blockId}/slides', {
          params: { path: { productId, blockId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateSlideMutation(productId: string, blockId: string) {
  const invalidate = useInvalidateContent(productId)
  return useMutation({
    mutationFn: ({ slideId, ...body }: UpdateSlideRequest & { slideId: string }) =>
      unwrap<ContentSlide>(
        api.PUT('/api/admin/products/{productId}/content/blocks/{blockId}/slides/{slideId}', {
          params: { path: { productId, blockId, slideId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteSlideMutation(productId: string, blockId: string) {
  const invalidate = useInvalidateContent(productId)
  return useMutation({
    mutationFn: (slideId: string) =>
      unwrap<void>(
        api.DELETE('/api/admin/products/{productId}/content/blocks/{blockId}/slides/{slideId}', {
          params: { path: { productId, blockId, slideId } },
        })
      ),
    onSuccess: invalidate,
  })
}

export function useReorderSlidesMutation(productId: string, blockId: string) {
  const invalidate = useInvalidateContent(productId)
  return useMutation({
    mutationFn: (body: { orderedIds: string[]; variantId?: string }) =>
      unwrap<unknown>(
        api.POST('/api/admin/products/{productId}/content/blocks/{blockId}/slides/reorder', {
          params: { path: { productId, blockId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useCopyContentMutation(productId: string) {
  const invalidate = useInvalidateContent(productId)
  return useMutation({
    mutationFn: (sourceProductId: string) =>
      unwrap<unknown>(
        api.POST('/api/admin/products/{productId}/content/copy', {
          params: { path: { productId } },
          body: { sourceProductId },
        })
      ),
    onSuccess: invalidate,
  })
}
