import { Badge } from '@/components/ui/badge'
import type { TeamMember } from '@/api/team'
import { TEAM_STATUS_LABEL } from '@/lib/labels'

const STATUS_STYLE: Record<
  NonNullable<TeamMember['status']>,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  INVITED: { label: TEAM_STATUS_LABEL.INVITED, variant: 'outline' },
  ACTIVE: { label: TEAM_STATUS_LABEL.ACTIVE, variant: 'default' },
  SUSPENDED: { label: TEAM_STATUS_LABEL.SUSPENDED, variant: 'secondary' },
  DEACTIVATED: { label: TEAM_STATUS_LABEL.DEACTIVATED, variant: 'destructive' },
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
