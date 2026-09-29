import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type User = components['schemas']['UserResponse']
export type UserSummary = components['schemas']['UserSummaryResponse']
export type UserStatus = NonNullable<User['status']>
export type UserRole = NonNullable<User['roles']>[number]
export type RoleGrant = components['schemas']['RoleGrantResponse']
type CreateUserRequest = components['schemas']['CreateUserRequest']
type UpdateUserRequest = components['schemas']['UpdateUserRequest']

export interface UserListParams {
  page: number
  size: number
  status?: UserStatus
  role?: UserRole
  search?: string
}

export function useUsersQuery(params: UserListParams) {
  return useQuery({
    queryKey: ['users', 'list', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/users', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              status: params.status,
              role: params.role,
              search: params.search || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: ['users', 'detail', id],
    queryFn: () => unwrap(api.GET('/api/admin/users/{id}', { params: { path: { id } } })),
  })
}

function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['users'] })
}

export function useCreateUserMutation() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (body: CreateUserRequest) => unwrap<User>(api.POST('/api/admin/users', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateUserMutation(id: string) {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (body: UpdateUserRequest) =>
      unwrap<User>(api.PUT('/api/admin/users/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  })
}

export type UserAction = 'grant-partner' | 'revoke-partner' | 'suspend' | 'reinstate'

/**
 * The four bodiless, versionless writes. Called by path, never by operationId (the
 * operation ids are positional and get renumbered when a controller is added).
 */
export function useUserActionMutation(id: string) {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (action: UserAction) => {
      const params = { params: { path: { id } } }
      switch (action) {
        case 'grant-partner':
          return unwrap<User>(api.POST('/api/admin/users/{id}/grant-partner', params))
        case 'revoke-partner':
          return unwrap<User>(api.POST('/api/admin/users/{id}/revoke-partner', params))
        case 'suspend':
          return unwrap<User>(api.POST('/api/admin/users/{id}/suspend', params))
        case 'reinstate':
          return unwrap<User>(api.POST('/api/admin/users/{id}/reinstate', params))
      }
    },
    onSuccess: invalidate,
  })
}
