import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type Category = components['schemas']['CategoryResponse']
export type CategoryStatus = NonNullable<Category['status']>
export type CategoryTreeNode = components['schemas']['CategoryTreeResponse']
type CreateCategoryRequest = components['schemas']['CreateCategoryRequest']
type UpdateCategoryRequest = components['schemas']['UpdateCategoryRequest']
type MoveCategoryRequest = components['schemas']['MoveCategoryRequest']
type ReorderCategoriesRequest = components['schemas']['ReorderCategoriesRequest']

export interface CategoryListParams {
  page: number
  size: number
  status?: CategoryStatus
  live?: boolean
  parentId?: string
  search?: string
}

export const categoriesQueryKey = (params: CategoryListParams) => ['categories', params] as const
export const categoryTreeQueryKey = ['categories', 'tree'] as const

export function useCategoriesQuery(params: CategoryListParams) {
  return useQuery({
    queryKey: categoriesQueryKey(params),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/categories', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              status: params.status,
              live: params.live,
              parentId: params.parentId,
              search: params.search || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

/** The tree endpoint returns a lighter shape (no description/imageUrl/bannerUrl) than the full
 * `CategoryResponse` — an edit dialog opened from the tree needs this, not the tree node. */
export function useCategoryQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['categories', 'detail', id],
    queryFn: () => unwrap(api.GET('/api/admin/categories/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  })
}

export function useCategoryTreeQuery() {
  return useQuery({
    queryKey: categoryTreeQueryKey,
    queryFn: () => unwrap(api.GET('/api/admin/categories/tree')),
  })
}

function useInvalidateCategories() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['categories'] })
}

export function useCreateCategoryMutation() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (body: CreateCategoryRequest) =>
      unwrap<Category>(api.POST('/api/admin/categories', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateCategoryMutation(id: string) {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (body: UpdateCategoryRequest) =>
      unwrap<Category>(api.PUT('/api/admin/categories/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  })
}

export function useMoveCategoryMutation() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: ({ id, ...body }: MoveCategoryRequest & { id: string }) =>
      unwrap<Category>(api.POST('/api/admin/categories/{id}/move', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  })
}

export function useActivateCategoryMutation() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<Category>(
        api.POST('/api/admin/categories/{id}/activate', { params: { path: { id } } })
      ),
    onSuccess: invalidate,
  })
}
export function usePublishCategoryMutation() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<Category>(
        api.POST('/api/admin/categories/{id}/publish', { params: { path: { id } } })
      ),
    onSuccess: invalidate,
  })
}
export function useUnpublishCategoryMutation() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<Category>(
        api.POST('/api/admin/categories/{id}/unpublish', { params: { path: { id } } })
      ),
    onSuccess: invalidate,
  })
}
export function useArchiveCategoryMutation() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<Category>(
        api.POST('/api/admin/categories/{id}/archive', { params: { path: { id } } })
      ),
    onSuccess: invalidate,
  })
}

export function useReorderCategoriesMutation() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (body: ReorderCategoriesRequest) =>
      unwrap<Category[]>(api.POST('/api/admin/categories/reorder', { body })),
    onSuccess: invalidate,
  })
}
