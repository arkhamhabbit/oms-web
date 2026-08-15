import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type PermissionDomain = components['schemas']['PermissionDomainResponse']

/**
 * The full permission catalog, grouped by domain — every key that exists, not the current
 * member's own grants (that's `profile.permissions`, see `usePermissions()`). Requires
 * `team.read`; a member without it gets a 403, which this surfaces as a normal query error
 * rather than blocking anything — nothing in this task's scope renders the catalog itself,
 * a future Roles screen does.
 */
export function usePermissionCatalogQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['permission-catalog'],
    queryFn: () => unwrap(api.GET('/api/admin/permissions')),
    enabled: options?.enabled,
  })
}
