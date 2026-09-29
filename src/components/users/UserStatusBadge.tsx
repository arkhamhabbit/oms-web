import { Badge } from '@/components/ui/badge'
import type { UserRole, UserStatus } from '@/api/users'

const STATUS: Record<
  UserStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  INVITED: { label: 'Invited', variant: 'outline' },
  ACTIVE: { label: 'Active', variant: 'default' },
  SUSPENDED: { label: 'Suspended', variant: 'destructive' },
}

function UserStatusBadge({ status }: { status: UserStatus | undefined }) {
  const style = status ? STATUS[status] : undefined
  return <Badge variant={style?.variant ?? 'outline'}>{style?.label ?? status ?? 'Unknown'}</Badge>
}

function UserRoleBadges({ roles }: { roles: UserRole[] | undefined }) {
  return (
    <span className="flex flex-wrap gap-1">
      {(roles ?? []).map((role) => (
        <Badge key={role} variant={role === 'PARTNER' ? 'default' : 'secondary'}>
          {role === 'PARTNER' ? 'Partner' : 'Consumer'}
        </Badge>
      ))}
    </span>
  )
}

export { UserStatusBadge, UserRoleBadges }
