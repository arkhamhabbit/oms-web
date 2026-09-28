import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type Attribute = components['schemas']['AttributeResponse']
export type AttributeKind = NonNullable<Attribute['kind']>
export type AttributeDataType = NonNullable<Attribute['dataType']>
export type AttributeAppliesTo = NonNullable<Attribute['appliesTo']>
export type AttributeValue = components['schemas']['AttributeValueResponse']
export type AttributeGroup = components['schemas']['AttributeGroupResponse']

type CreateAttributeRequest = components['schemas']['CreateAttributeRequest']
type UpdateAttributeRequest = components['schemas']['UpdateAttributeRequest']
type CreateValueRequest = components['schemas']['CreateValueRequest']
type UpdateValueRequest = components['schemas']['UpdateValueRequest']
type CreateAttributeGroupRequest = components['schemas']['CreateAttributeGroupRequest']
type UpdateAttributeGroupRequest = components['schemas']['UpdateAttributeGroupRequest']
type ReorderRequest = components['schemas']['ReorderRequest']

export interface AttributeListParams {
  page: number
  size: number
  kind?: AttributeKind
  groupId?: string
  active?: boolean
  search?: string
}

const ATTRIBUTES_KEY = 'attributes'
const GROUPS_KEY = 'attribute-groups'

export const attributesQueryKey = (params: AttributeListParams) => [ATTRIBUTES_KEY, params] as const
export const attributeValuesQueryKey = (attributeId: string | undefined) =>
  [ATTRIBUTES_KEY, 'values', attributeId] as const
export const attributeGroupsQueryKey = (active?: boolean) => [GROUPS_KEY, { active }] as const

// ---- Attributes ------------------------------------------------------------------------

export function useAttributesQuery(params: AttributeListParams) {
  return useQuery({
    queryKey: attributesQueryKey(params),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/attributes', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              kind: params.kind,
              groupId: params.groupId,
              active: params.active,
              search: params.search || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

function useInvalidateAttributes() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [ATTRIBUTES_KEY] })
}

export function useCreateAttributeMutation() {
  const invalidate = useInvalidateAttributes()
  return useMutation({
    mutationFn: (body: CreateAttributeRequest) =>
      unwrap<Attribute>(api.POST('/api/admin/attributes', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateAttributeMutation(id: string) {
  const invalidate = useInvalidateAttributes()
  return useMutation({
    mutationFn: (body: UpdateAttributeRequest) =>
      unwrap<Attribute>(api.PUT('/api/admin/attributes/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  })
}

export function useDeactivateAttributeMutation() {
  const invalidate = useInvalidateAttributes()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<Attribute>(
        api.POST('/api/admin/attributes/{id}/deactivate', { params: { path: { id } } })
      ),
    onSuccess: invalidate,
  })
}

export function useReactivateAttributeMutation() {
  const invalidate = useInvalidateAttributes()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<Attribute>(
        api.POST('/api/admin/attributes/{id}/reactivate', { params: { path: { id } } })
      ),
    onSuccess: invalidate,
  })
}

export function useReorderAttributesMutation() {
  const invalidate = useInvalidateAttributes()
  return useMutation({
    mutationFn: (body: ReorderRequest) =>
      unwrap<Attribute[]>(api.POST('/api/admin/attributes/reorder', { body })),
    onSuccess: invalidate,
  })
}

// ---- Values -----------------------------------------------------------------------------

export function useAttributeValuesQuery(attributeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: attributeValuesQueryKey(attributeId),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/attributes/{attributeId}/values', {
          params: { path: { attributeId: attributeId! } },
        })
      ),
    enabled: !!attributeId && enabled,
  })
}

function useInvalidateValues(attributeId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: attributeValuesQueryKey(attributeId) })
}

export function useAddValueMutation(attributeId: string) {
  const invalidate = useInvalidateValues(attributeId)
  return useMutation({
    mutationFn: (body: CreateValueRequest) =>
      unwrap<AttributeValue>(
        api.POST('/api/admin/attributes/{attributeId}/values', {
          params: { path: { attributeId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateValueMutation(attributeId: string, valueId: string) {
  const invalidate = useInvalidateValues(attributeId)
  return useMutation({
    mutationFn: (body: UpdateValueRequest) =>
      unwrap<AttributeValue>(
        api.PUT('/api/admin/attributes/{attributeId}/values/{valueId}', {
          params: { path: { attributeId, valueId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useDeactivateValueMutation(attributeId: string) {
  const invalidate = useInvalidateValues(attributeId)
  return useMutation({
    mutationFn: (valueId: string) =>
      unwrap<AttributeValue>(
        api.POST('/api/admin/attributes/{attributeId}/values/{valueId}/deactivate', {
          params: { path: { attributeId, valueId } },
        })
      ),
    onSuccess: invalidate,
  })
}

export function useReactivateValueMutation(attributeId: string) {
  const invalidate = useInvalidateValues(attributeId)
  return useMutation({
    mutationFn: (valueId: string) =>
      unwrap<AttributeValue>(
        api.POST('/api/admin/attributes/{attributeId}/values/{valueId}/reactivate', {
          params: { path: { attributeId, valueId } },
        })
      ),
    onSuccess: invalidate,
  })
}

export function useReorderValuesMutation(attributeId: string) {
  const invalidate = useInvalidateValues(attributeId)
  return useMutation({
    mutationFn: (body: ReorderRequest) =>
      unwrap<AttributeValue[]>(
        api.POST('/api/admin/attributes/{attributeId}/values/reorder', {
          params: { path: { attributeId } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

// ---- Groups -----------------------------------------------------------------------------

export function useAttributeGroupsQuery(active?: boolean) {
  return useQuery({
    queryKey: attributeGroupsQueryKey(active),
    queryFn: () =>
      unwrap(api.GET('/api/admin/attribute-groups', { params: { query: { active } } })),
  })
}

function useInvalidateGroups() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [GROUPS_KEY] })
}

export function useCreateAttributeGroupMutation() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: (body: CreateAttributeGroupRequest) =>
      unwrap<AttributeGroup>(api.POST('/api/admin/attribute-groups', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateAttributeGroupMutation(id: string) {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: (body: UpdateAttributeGroupRequest) =>
      unwrap<AttributeGroup>(
        api.PUT('/api/admin/attribute-groups/{id}', { params: { path: { id } }, body })
      ),
    onSuccess: invalidate,
  })
}

export function useDeactivateAttributeGroupMutation() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<AttributeGroup>(
        api.POST('/api/admin/attribute-groups/{id}/deactivate', { params: { path: { id } } })
      ),
    onSuccess: invalidate,
  })
}

export function useReactivateAttributeGroupMutation() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<AttributeGroup>(
        api.POST('/api/admin/attribute-groups/{id}/reactivate', { params: { path: { id } } })
      ),
    onSuccess: invalidate,
  })
}

export function useReorderAttributeGroupsMutation() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: (body: ReorderRequest) =>
      unwrap<AttributeGroup[]>(api.POST('/api/admin/attribute-groups/reorder', { body })),
    onSuccess: invalidate,
  })
}
