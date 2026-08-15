import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

type LoginRequest = components['schemas']['LoginRequest']
type LoginResponse = components['schemas']['LoginResponse']
type AcceptInviteRequest = components['schemas']['AcceptInviteRequest']
type RequestPasswordResetRequest = components['schemas']['RequestPasswordResetRequest']
type CompletePasswordResetRequest = components['schemas']['CompletePasswordResetRequest']
type ChangePasswordRequest = components['schemas']['ChangePasswordRequest']
type UpdateProfileRequest = components['schemas']['UpdateProfileRequest']
export type ProfileResponse = components['schemas']['ProfileResponse']

export const profileQueryKey = ['profile'] as const

/**
 * The source of truth for "who is logged in" — the whole app, including `RequireAuth`,
 * hangs off this one query. A 401 here means "not logged in" and is handled generically by
 * the client's `onUnauthorized` hook rather than by this hook itself.
 */
export function useProfileQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: () => unwrap(api.GET('/api/admin/profile')),
    retry: false,
    enabled: options?.enabled,
  })
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: (body: LoginRequest) =>
      unwrap<LoginResponse>(api.POST('/api/admin/auth/login', { body })),
  })
}

/** Logout must clear the whole cache (not just profile) — see D2.16 / the task's done-criteria: a surviving cache leaks the previous user's data into the next session on a shared machine. */
export function useLogoutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/admin/auth/logout')),
    onSettled: () => queryClient.clear(),
  })
}

export function useAcceptInviteMutation() {
  return useMutation({
    mutationFn: (body: AcceptInviteRequest) =>
      unwrap(api.POST('/api/admin/auth/accept-invite', { body })),
  })
}

export function useRequestPasswordResetMutation() {
  return useMutation({
    mutationFn: (body: RequestPasswordResetRequest) =>
      unwrap(api.POST('/api/admin/auth/request-password-reset', { body })),
  })
}

export function useCompletePasswordResetMutation() {
  return useMutation({
    mutationFn: (body: CompletePasswordResetRequest) =>
      unwrap(api.POST('/api/admin/auth/complete-password-reset', { body })),
  })
}

/** Also used for the forced-change-on-first-login flow — same endpoint, same request shape. */
export function useChangePasswordMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) =>
      unwrap(api.POST('/api/admin/profile/change-password', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey }),
  })
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => unwrap(api.PUT('/api/admin/profile', { body })),
    onSuccess: (data) => queryClient.setQueryData(profileQueryKey, data),
  })
}
