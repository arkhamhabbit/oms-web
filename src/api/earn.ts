import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

type Schemas = components['schemas']

export type EarnRules = Schemas['EarnRulesResponse']
export type EarnRulesState = NonNullable<EarnRules['state']>
export type EarnRulesStatus = NonNullable<EarnRules['status']>

type CreateEarnRulesRequest = Schemas['CreateEarnRulesRequest']
type UpdateEarnRulesRequest = Schemas['UpdateEarnRulesRequest']
type PublishEarnRulesRequest = Schemas['PublishEarnRulesRequest']

const EARN_KEY = 'earn'

/** The version in effect now. Needs `earn.read`. */
export function useEffectiveEarnRulesQuery() {
  return useQuery({
    queryKey: [EARN_KEY, 'effective'],
    queryFn: () => unwrap(api.GET('/api/admin/earn/versions/effective')),
  })
}

export function useEarnRulesVersionsQuery(
  params: { page: number; size: number; status?: EarnRulesStatus } = { page: 0, size: 50 }
) {
  return useQuery({
    queryKey: [EARN_KEY, 'versions', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/earn/versions', {
          params: {
            query: { pageable: { page: params.page, size: params.size }, status: params.status },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useEarnRulesVersionQuery(id: string) {
  return useQuery({
    queryKey: [EARN_KEY, 'version', id],
    queryFn: () => unwrap(api.GET('/api/admin/earn/versions/{id}', { params: { path: { id } } })),
  })
}

function useInvalidateEarn() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [EARN_KEY] })
}

export function useCreateEarnRulesMutation() {
  const invalidate = useInvalidateEarn()
  return useMutation({
    mutationFn: (body: CreateEarnRulesRequest) =>
      unwrap<EarnRules>(api.POST('/api/admin/earn/versions', { body })),
    onSuccess: invalidate,
  })
}

export function useUpdateEarnRulesMutation(id: string) {
  const invalidate = useInvalidateEarn()
  return useMutation({
    mutationFn: (body: UpdateEarnRulesRequest) =>
      unwrap<EarnRules>(
        api.PUT('/api/admin/earn/versions/{id}', { params: { path: { id } }, body })
      ),
    onSuccess: invalidate,
  })
}

export function usePublishEarnRulesMutation(id: string) {
  const invalidate = useInvalidateEarn()
  return useMutation({
    mutationFn: (body: PublishEarnRulesRequest) =>
      unwrap<EarnRules>(
        api.POST('/api/admin/earn/versions/{id}/publish', { params: { path: { id } }, body })
      ),
    onSuccess: invalidate,
  })
}

export function useWithdrawEarnRulesMutation(id: string) {
  const invalidate = useInvalidateEarn()
  return useMutation({
    mutationFn: (version: number) =>
      unwrap<EarnRules>(
        api.POST('/api/admin/earn/versions/{id}/withdraw', {
          params: { path: { id } },
          body: { version },
        })
      ),
    onSuccess: invalidate,
  })
}
