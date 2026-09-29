import { Badge } from '@/components/ui/badge'
import type { TeamMember } from '@/api/team'

const STATUS_STYLE: Record<
  NonNullable<TeamMember['status']>,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  INVITED: { label: 'Invited', variant: 'outline' },
  ACTIVE: { label: 'Active', variant: 'default' },
  SUSPENDED: { label: 'Suspended', variant: 'secondary' },
  DEACTIVATED: { label: 'Deactivated', variant: 'destructive' },
}

function MemberStatusBadge({ status, locked }: { status: TeamMember['status']; locked?: boolean }) {
  const style = status ? STATUS_STYLE[status] : undefined
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={style?.variant ?? 'outline'}>{style?.label ?? status ?? 'Unknown'}</Badge>
      {locked && <Badge variant="secondary">Locked</Badge>}
    </span>
  )
}

export { MemberStatusBadge }
