import * as React from 'react'

import { useUserTierQuery } from '@/api/membership'
import { useUsersQuery, type UserSummary } from '@/api/users'
import { usePermissions } from '@/auth/usePermissions'
import { TierBadge } from '@/components/membership/TierBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { isApiError } from '@/lib/api-error'
import { labelOf, USER_STATUS_LABEL } from '@/lib/labels'
import { useDebounced } from '@/lib/use-debounced'

/** Why a member cannot be chosen; undefined when they can. Only an ACTIVE member can have an order placed. */
export function memberBlockedReason(status: UserSummary['status']): string | undefined {
  switch (status) {
    case 'ACTIVE':
      return undefined
    case 'INVITED':
      return 'Invited but not yet joined: an order cannot be placed until they are active.'
    case 'SUSPENDED':
      return 'Suspended: an order cannot be placed for a suspended member.'
    default:
      return 'Not an active member.'
  }
}

function MemberTier({ userId }: { userId: string }) {
  const { has } = usePermissions()
  const tier = useUserTierQuery(userId, has('membership.read'))
  const current = tier.data?.tier
  return current?.tierCode ? <TierBadge code={current.tierCode} name={current.tierName} /> : null
}

function MemberLine({ member }: { member: UserSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-medium">{member.name ?? 'Unnamed'}</span>
      <span className="font-mono text-xs text-muted-foreground">{member.mobile ?? '—'}</span>
      {member.id && <MemberTier userId={member.id} />}
      <Badge variant={member.status === 'ACTIVE' ? 'secondary' : 'outline'}>
        {labelOf(USER_STATUS_LABEL, member.status)}
      </Badge>
    </div>
  )
}

/** Step 1: search by mobile or name; pick one active member. */
function MemberChooser({
  value,
  onChange,
}: {
  value: UserSummary | undefined
  onChange: (member: UserSummary | undefined) => void
}) {
  const [text, setText] = React.useState('')
  const search = useDebounced(text.trim(), 300)
  const enabled = search.length >= 2 && !value
  const results = useUsersQuery({ page: 0, size: 8, search: enabled ? search : '' })
  const rows = enabled ? (results.data?.content ?? []) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Member</CardTitle>
        <CardDescription>Search by mobile number or name. Only an active member can be chosen.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {value ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <MemberLine member={value} />
            <Button variant="outline" size="sm" onClick={() => onChange(undefined)}>
              Change member
            </Button>
          </div>
        ) : (
          <>
            <Input
              aria-label="Search members"
              placeholder="Mobile or name, e.g. +919999900001"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {search.length > 0 && search.length < 2 && (
              <p className="text-xs text-muted-foreground">Type at least two characters.</p>
            )}
            {results.isError && (
              <p role="alert" className="text-sm text-destructive">
                {isApiError(results.error) ? results.error.message : 'Members could not be searched.'}
              </p>
            )}
            {enabled && !results.isLoading && !results.isError && rows.length === 0 && (
              <p className="text-sm text-muted-foreground">No member matches “{search}”.</p>
            )}
            <ul className="flex flex-col gap-2">
              {rows.map((m) => {
                const blocked = memberBlockedReason(m.status)
                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <MemberLine member={m} />
                      {blocked && <span className="text-xs text-muted-foreground">{blocked}</span>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!blocked}
                      title={blocked}
                      aria-label={`Choose ${m.name ?? m.mobile}`}
                      onClick={() => onChange(m)}
                    >
                      Choose
                    </Button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export { MemberChooser }
