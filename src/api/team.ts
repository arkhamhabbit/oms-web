import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import { profileQueryKey } from '@/api/auth'
import type { components } from '@/api/schema.gen'

export type TeamMember = components['schemas']['TeamMemberResponse']
export type TeamMemberStatus = NonNullable<TeamMember['status']>
export type InvitedTeamMember = components['schemas']['InvitedTeamMemberResponse']
export type PasswordResetLink = components['schemas']['PasswordResetLinkResponse']
export type ForceLogoutResult = components['schemas']['ForceLogoutResponse']
type CreateTeamMemberRequest = components['schemas']['CreateTeamMemberRequest']
type UpdateTeamMemberRequest = components['schemas']['UpdateTeamMemberRequest']
type AssignRolesRequest = components['schemas']['AssignRolesRequest']

export interface TeamListParams {
  page: number
  size: number
  status?: TeamMemberStatus
}

export function useTeamMembersQuery(params: TeamListParams) {
  return useQuery({
    queryKey: ['team-members', 'list', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/team-members', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              status: params.status,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useTeamMemberQuery(id: string) {
  return useQuery({
    queryKey: ['team-members', 'detail', id],
    queryFn: () => unwrap(api.GET('/api/admin/team-members/{id}', { params: { path: { id } } })),
  })
}

/**
 * Every write refreshes the member and role queries, and the profile too — the profile is what
 * gates nav, so a role change that touches the current member is picked up at once. Permissions
 * resolve per request server-side (D5.6); nothing here assumes a snapshot.
 */
function useInvalidateTeam() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['team-members'] })
    void queryClient.invalidateQueries({ queryKey: ['roles'] })
    void queryClient.invalidateQueries({ queryKey: profileQueryKey })
  }
}

export function useCreateTeamMemberMutation() {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: (body: CreateTeamMemberRequest) =>
      unwrap<InvitedTeamMember>(api.POST('/api/admin/team-members', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateTeamMemberMutation(id: string) {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: (body: UpdateTeamMemberRequest) =>
      unwrap<TeamMember>(
        api.PUT('/api/admin/team-members/{id}', { params: { path: { id } }, body })
      ),
    onSuccess: invalidate,
  })
}

export function useAssignRolesMutation(id: string) {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: (body: AssignRolesRequest) =>
      unwrap<TeamMember>(
        api.PUT('/api/admin/team-members/{id}/roles', { params: { path: { id } }, body })
      ),
    onSuccess: invalidate,
  })
}

export type MemberStatusAction = 'activate' | 'suspend' | 'deactivate'

export function useMemberStatusMutation(id: string) {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: (action: MemberStatusAction) => {
      const params = { params: { path: { id } } }
      switch (action) {
        case 'activate':
          return unwrap<TeamMember>(api.POST('/api/admin/team-members/{id}/activate', params))
        case 'suspend':
          return unwrap<TeamMember>(api.POST('/api/admin/team-members/{id}/suspend', params))
        case 'deactivate':
          return unwrap<TeamMember>(api.POST('/api/admin/team-members/{id}/deactivate', params))
      }
    },
    onSuccess: invalidate,
  })
}

export function useForceLogoutMutation(id: string) {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: () =>
      unwrap<ForceLogoutResult>(
        api.POST('/api/admin/team-members/{id}/force-logout', { params: { path: { id } } })
      ),
    onSuccess: invalidate,
  })
}

export function useResetPasswordMutation(id: string) {
  return useMutation({
    mutationFn: () =>
      unwrap<PasswordResetLink>(
        api.POST('/api/admin/team-members/{id}/reset-password', { params: { path: { id } } })
      ),
  })
}

export function useResendInviteMutation(id: string) {
  const invalidate = useInvalidateTeam()
  return useMutation({
    mutationFn: () =>
      unwrap<InvitedTeamMember>(
        api.POST('/api/admin/team-members/{id}/resend-invite', { params: { path: { id } } })
      ),
    onSuccess: invalidate,
  })
}
