import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type AuditEntry = components['schemas']['AuditEntryResponse']

export interface AuditListParams {
  page: number
  size: number
  entityType?: string
  entityId?: string
  actorId?: string
  action?: string
  /** Inclusive, UTC instant. */
  from?: string
  /** Exclusive, UTC instant. */
  to?: string
}

/** Read-only: there is deliberately no mutation in this module. */
export function useAuditEntriesQuery(params: AuditListParams) {
  const { page, size, ...filters } = params
  return useQuery({
    queryKey: ['audit-entries', params],
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/audit-entries', {
          params: {
            query: {
              pageable: { page, size },
              entityType: filters.entityType || undefined,
              entityId: filters.entityId || undefined,
              actorId: filters.actorId || undefined,
              action: filters.action || undefined,
              from: filters.from || undefined,
              to: filters.to || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}
