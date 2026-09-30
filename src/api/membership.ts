import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'

export type Tier = components['schemas']['TierResponse']

/**
 * The tier ladder in effect now. Anything that references a tier keys off its stable `code`
 * (D7.9) — a new membership version creates new tier rows with new ids, so an id would break on
 * every version bump. Needs `membership.read`.
 */
export function useEffectiveLadderQuery(enabled = true) {
  return useQuery({
    queryKey: ['membership', 'effective'],
    enabled,
    queryFn: () => unwrap(api.GET('/api/admin/membership/versions/effective')),
    select: (version) => version.tiers ?? [],
  })
}
