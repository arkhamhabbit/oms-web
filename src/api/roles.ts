import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import { profileQueryKey } from '@/api/auth'
import type { components } from '@/api/schema.gen'

export type Role = components['schemas']['RoleResponse']
type CreateRoleRequest = components['schemas']['CreateRoleRequest']
type UpdateRoleRequest = components['schemas']['UpdateRoleRequest']

export function useRolesQuery() {
  return useQuery({
    queryKey: ['roles', 'list'],
    queryFn: () => unwrap(api.GET('/api/admin/roles')),
  })
}

function useInvalidateRoles() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['roles'] })
    // A role edit changes members' effective permissions (D5.6), possibly the current
    // member's own — re-read the profile rather than assuming it is unchanged.
    void queryClient.invalidateQueries({ queryKey: ['team-members'] })
    void queryClient.invalidateQueries({ queryKey: profileQueryKey })
  }
}

export function useCreateRoleMutation() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (body: CreateRoleRequest) => unwrap<Role>(api.POST('/api/admin/roles', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateRoleMutation(id: string) {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (body: UpdateRoleRequest) =>
      unwrap<Role>(api.PUT('/api/admin/roles/{id}', { params: { path: { id } }, body })),
    onSuccess: invalidate,
  })
}

export function useDeleteRoleMutation() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/admin/roles/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  })
}
