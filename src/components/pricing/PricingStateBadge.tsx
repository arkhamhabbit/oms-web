import { Badge } from '@/components/ui/badge'
import type { PricingVersionState } from '@/api/pricing'

const STATE: Record<
  PricingVersionState,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  SCHEDULED: { label: 'Scheduled', variant: 'secondary' },
  EFFECTIVE: { label: 'Effective', variant: 'default' },
  SUPERSEDED: { label: 'Superseded', variant: 'outline' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'destructive' },
}

/** The derived `state` (exactly one version is EFFECTIVE), not the stored `status`. */
function PricingStateBadge({ state }: { state: PricingVersionState | undefined }) {
  const style = state ? STATE[state] : undefined
  return <Badge variant={style?.variant ?? 'outline'}>{style?.label ?? state ?? 'Unknown'}</Badge>
}

export { PricingStateBadge }
