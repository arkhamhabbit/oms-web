import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type Invite = components['schemas']['InviteResponse']
export type InviteStatus = NonNullable<Invite['status']>
export type WaitlistEntry = components['schemas']['WaitlistEntryResponse']
type IssueInviteRequest = components['schemas']['IssueInviteRequest']

export interface InviteListParams {
  page: number
  size: number
  status?: InviteStatus
}

/** `status` filters on the *effective* status — an open invite past expiry reads EXPIRED. */
export function useInvitesQuery(params: InviteListParams) {
  return useQuery({
    queryKey: ['invites', 'list', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/invites', {
          params: {
            query: { pageable: { page: params.page, size: params.size }, status: params.status },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useInviteQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['invites', 'detail', id],
    enabled: !!id,
    queryFn: () => unwrap(api.GET('/api/admin/invites/{id}', { params: { path: { id: id! } } })),
  })
}

export interface WaitlistParams {
  page: number
  size: number
  waitingOnly: boolean
}

export function useWaitlistQuery(params: WaitlistParams) {
  return useQuery({
    queryKey: ['waitlist', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/waitlist', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              waitingOnly: params.waitingOnly,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

/** An invite from either door changes both lists — the waitlist entry is stamped invited. */
function useInvalidateInvites() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['invites'] }),
      queryClient.invalidateQueries({ queryKey: ['waitlist'] }),
    ])
}

export function useIssueInviteMutation() {
  const invalidate = useInvalidateInvites()
  return useMutation({
    mutationFn: (body: IssueInviteRequest) =>
      unwrap<Invite>(api.POST('/api/admin/invites', { body })),
    onSuccess: invalidate,
  })
}

export function useInviteFromWaitlistMutation() {
  const invalidate = useInvalidateInvites()
  return useMutation({
    mutationFn: ({ entryId, name }: { entryId: string; name?: string }) =>
      unwrap<Invite>(
        api.POST('/api/admin/waitlist/{id}/invite', {
          params: { path: { id: entryId } },
          body: { name },
        })
      ),
    onSuccess: invalidate,
  })
}

export function useInvalidateInviteMutation(id: string) {
  const invalidate = useInvalidateInvites()
  return useMutation({
    mutationFn: (reason: string) =>
      unwrap<Invite>(
        api.POST('/api/admin/invites/{id}/invalidate', {
          params: { path: { id } },
          body: { reason },
        })
      ),
    onSuccess: invalidate,
  })
}
