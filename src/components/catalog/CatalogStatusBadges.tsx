import { Badge } from '@/components/ui/badge'
import type { CatalogStatus } from '@/lib/catalog-transitions'

export function statusBadgeVariant(status: CatalogStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'default' as const
    case 'IN_REVIEW':
      return 'secondary' as const
    default:
      return 'outline' as const
  }
}

/** The two lifecycle axes (D4.8), rendered as their own badges — never merged into one. */
export function CatalogStatusBadges({ status, live }: { status: CatalogStatus; live: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
      {live && <Badge variant="secondary">LIVE</Badge>}
    </span>
  )
}
