import { Badge } from '@/components/ui/badge'
import type { InviteStatus } from '@/api/invites'

/**
 * The invite state machine: PENDING → VISITED (link opened) → ADDED (claimed), or EXPIRED /
 * INVALID, both terminal. The status shown is *effective* — an open invite past its expiry
 * reads EXPIRED even before the sweep stores it.
 */
export const INVITE_STATUS: Record<
  InviteStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; help: string }
> = {
  PENDING: { label: 'Pending', variant: 'outline', help: 'Issued; the link has not been opened.' },
  VISITED: {
    label: 'Visited',
    variant: 'secondary',
    help: 'The link was opened; not yet claimed.',
  },
  ADDED: { label: 'Added', variant: 'default', help: 'Claimed — the number is now an Insider.' },
  EXPIRED: { label: 'Expired', variant: 'outline', help: 'Not claimed within its validity.' },
  INVALID: {
    label: 'Invalid',
    variant: 'destructive',
    help: 'Marked bad or unreachable by an admin.',
  },
}

function InviteStatusBadge({ status }: { status: InviteStatus | undefined }) {
  const style = status ? INVITE_STATUS[status] : undefined
  return (
    <Badge variant={style?.variant ?? 'outline'} title={style?.help}>
      {style?.label ?? status ?? 'Unknown'}
    </Badge>
  )
}

export { InviteStatusBadge }
