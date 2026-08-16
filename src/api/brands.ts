import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type Brand = components['schemas']['BrandResponse']
export type BrandStatus = NonNullable<Brand['status']>
type CreateBrandRequest = components['schemas']['CreateBrandRequest']
type UpdateBrandRequest = components['schemas']['UpdateBrandRequest']
type ReorderRequest = components['schemas']['ReorderRequest']

export interface BrandListParams {
  page: number
  size: number
  status?: BrandStatus
  live?: boolean
  search?: string
}

export const brandsQueryKey = (params: BrandListParams) => ['brands', params] as const

export function useBrandsQuery(params: BrandListParams) {
  return useQuery({
    queryKey: brandsQueryKey(params),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/brands', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              status: params.status,
              live: params.live,
              search: params.search || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

function useInvalidateBrands() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['brands'] })
}

export function useCreateBrandMutation() {
  const invalidate = useInvalidateBrands()
  return useMutation({
    mutationFn: (body: CreateBrandRequest) =>
      unwrap<Brand>(api.POST('/api/admin/brands', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateBrandMutation(id: string) {
  const invalidate = useInvalidateBrands()
  return useMutation({
    mutationFn: (body: UpdateBrandRequest) =>
      unwrap<Brand>(api.PUT('/api/admin/brands/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  })
}

export function useActivateBrandMutation() {
  const invalidate = useInvalidateBrands()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<Brand>(api.POST('/api/admin/brands/{id}/activate', { params: { path: { id } } })),
    onSuccess: invalidate,
  })
}
export function usePublishBrandMutation() {
  const invalidate = useInvalidateBrands()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<Brand>(api.POST('/api/admin/brands/{id}/publish', { params: { path: { id } } })),
    onSuccess: invalidate,
  })
}
export function useUnpublishBrandMutation() {
  const invalidate = useInvalidateBrands()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<Brand>(api.POST('/api/admin/brands/{id}/unpublish', { params: { path: { id } } })),
    onSuccess: invalidate,
  })
}
export function useArchiveBrandMutation() {
  const invalidate = useInvalidateBrands()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<Brand>(api.POST('/api/admin/brands/{id}/archive', { params: { path: { id } } })),
    onSuccess: invalidate,
  })
}

export function useReorderBrandsMutation() {
  const invalidate = useInvalidateBrands()
  return useMutation({
    mutationFn: (body: ReorderRequest) =>
      unwrap<Brand[]>(api.POST('/api/admin/brands/reorder', { body })),
    onSuccess: invalidate,
  })
}
