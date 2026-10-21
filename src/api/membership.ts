import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

type Schemas = components['schemas']

export type Tier = Schemas['TierResponse']
export type TierInput = Schemas['TierRequest']
export type TierPricingLevel = TierInput['pricingLevel']
export type MembershipVersion = Schemas['VersionResponse']
export type MembershipVersionState = NonNullable<MembershipVersion['state']>
export type MembershipVersionStatus = NonNullable<MembershipVersion['status']>
export type UserTier = Schemas['UserTierResponse']
export type TierTransition = Schemas['TierTransitionResponse']
export type CycleRun = Schemas['CycleRunResponse']

type CreateVersionRequest = Schemas['CreateVersionRequest']
type UpdateVersionRequest = Schemas['UpdateVersionRequest']
type PublishVersionRequest = Schemas['PublishVersionRequest']

const MEMBERSHIP_KEY = 'membership'

/**
 * The tier ladder in effect now. Anything that references a tier keys off its stable `code`
 * (D7.9) — a new membership version creates new tier rows with new ids, so an id would break on
 * every version bump. Needs `membership.read`.
 */
export function useEffectiveLadderQuery(enabled = true) {
  return useQuery({
    queryKey: [MEMBERSHIP_KEY, 'effective'],
    enabled,
    queryFn: () => unwrap(api.GET('/api/admin/membership/versions/effective')),
    select: (version) => version.tiers ?? [],
  })
}

/** The whole effective version (name, effective-from, ladder) rather than only its tiers. */
export function useEffectiveVersionQuery() {
  return useQuery({
    queryKey: [MEMBERSHIP_KEY, 'effective-version'],
    queryFn: () => unwrap(api.GET('/api/admin/membership/versions/effective')),
  })
}

export function useMembershipVersionsQuery(
  params: { page: number; size: number; status?: MembershipVersionStatus } = { page: 0, size: 50 }
) {
  return useQuery({
    queryKey: [MEMBERSHIP_KEY, 'versions', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/membership/versions', {
          params: {
            query: { pageable: { page: params.page, size: params.size }, status: params.status },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useMembershipVersionQuery(id: string) {
  return useQuery({
    queryKey: [MEMBERSHIP_KEY, 'version', id],
    queryFn: () =>
      unwrap(api.GET('/api/admin/membership/versions/{id}', { params: { path: { id } } })),
  })
}

function useInvalidateMembership() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [MEMBERSHIP_KEY] })
}

export function useCreateMembershipVersionMutation() {
  const invalidate = useInvalidateMembership()
  return useMutation({
    mutationFn: (body: CreateVersionRequest) =>
      unwrap<MembershipVersion>(api.POST('/api/admin/membership/versions', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateMembershipVersionMutation(id: string) {
  const invalidate = useInvalidateMembership()
  return useMutation({
    mutationFn: (body: UpdateVersionRequest) =>
      unwrap<MembershipVersion>(
        api.PUT('/api/admin/membership/versions/{id}', { params: { path: { id } }, body })
      ),
    onSuccess: invalidate,
  })
}

export function usePublishMembershipVersionMutation(id: string) {
  const invalidate = useInvalidateMembership()
  return useMutation({
    mutationFn: (body: PublishVersionRequest) =>
      unwrap<MembershipVersion>(
        api.POST('/api/admin/membership/versions/{id}/publish', {
          params: { path: { id } },
          body,
        })
      ),
    onSuccess: invalidate,
  })
}

export function useWithdrawMembershipVersionMutation(id: string) {
  const invalidate = useInvalidateMembership()
  return useMutation({
    mutationFn: (version: number) =>
      unwrap<MembershipVersion>(
        api.POST('/api/admin/membership/versions/{id}/withdraw', {
          params: { path: { id } },
          body: { version },
        })
      ),
    onSuccess: invalidate,
  })
}

/** A user's stored tier plus the live cycle figures (D7.15). Needs `membership.read`. */
export function useUserTierQuery(userId: string, enabled = true) {
  return useQuery({
    queryKey: [MEMBERSHIP_KEY, 'user-tier', userId],
    enabled,
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/membership/users/{userId}/tier', { params: { path: { userId } } })
      ),
  })
}

export function useUserTierHistoryQuery(
  userId: string,
  page: number,
  size: number,
  enabled = true
) {
  return useQuery({
    queryKey: [MEMBERSHIP_KEY, 'user-tier-history', userId, page, size],
    enabled,
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/membership/users/{userId}/tier/history', {
          params: { path: { userId }, query: { pageable: { page, size } } },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

/**
 * Runs the cycle-end evaluation now. It can drop members a tier, so the whole `membership`
 * cache is invalidated — any open member's tier state may have moved.
 */
export function useRunCyclesMutation() {
  const invalidate = useInvalidateMembership()
  return useMutation({
    mutationFn: () => unwrap<CycleRun>(api.POST('/api/admin/membership/cycles/run')),
    onSuccess: invalidate,
  })
}
