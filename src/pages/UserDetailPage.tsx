import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangleIcon, ArrowLeftIcon, InfoIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { UserRoleBadges, UserStatusBadge } from '@/components/users/UserStatusBadge'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError, isVersionConflict } from '@/lib/api-error'
import {
  useUpdateUserMutation,
  useUserActionMutation,
  useUserQuery,
  type RoleGrant,
  type User,
} from '@/api/users'

interface Notice {
  text: string
  traceId?: string
}

function noticeFromError(error: unknown): Notice {
  if (isVersionConflict(error)) {
    return {
      text: 'This user was changed by someone else — reload to see the latest, then try again.',
      traceId: isApiError(error) ? error.traceId : undefined,
    }
  }
  if (isApiError(error)) {
    return { text: error.message, traceId: error.traceId }
  }
  return { text: error instanceof Error ? error.message : 'Something went wrong' }
}

function formatDate(value: string | undefined) {
  return value ? new Date(value).toLocaleString() : ''
}

function BackLink() {
  return (
    <Link
      to="/users"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" /> Users
    </Link>
  )
}

function Explainer({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
      <InfoIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

function UserDetailPage() {
  const { id = '' } = useParams()
  const { has } = usePermissions()
  const userQuery = useUserQuery(id)
  const user = userQuery.data

  useBreadcrumb([{ label: 'Users', to: '/users' }, { label: user?.name ?? 'User' }])

  const [notice, setNotice] = React.useState<Notice | undefined>()
  const [stale, setStale] = React.useState(false)

  function fail(error: unknown) {
    setNotice(noticeFromError(error))
    setStale(isVersionConflict(error))
  }
  function reload() {
    setNotice(undefined)
    setStale(false)
    void userQuery.refetch()
  }

  if (userQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (userQuery.isError || !user) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <p className="text-sm">
          {isApiError(userQuery.error) ? userQuery.error.message : 'This user could not be loaded.'}
        </p>
      </div>
    )
  }

  const canWrite = has('identity.user.write')
  const canSuspend = has('identity.user.suspend')

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <BackLink />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{user.mobile}</h1>
        <UserStatusBadge status={user.status} />
        <UserRoleBadges roles={user.roles} />
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        {user.name} · Mobile is this customer&apos;s identity and can&apos;t be changed here.
      </p>

      {notice && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex-1">
            <p>{notice.text}</p>
            {notice.traceId && (
              <p className="text-xs text-muted-foreground">Trace ID: {notice.traceId}</p>
            )}
          </div>
          {stale && (
            <Button size="sm" variant="outline" onClick={reload}>
              Reload
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setNotice(undefined)}>
            Dismiss
          </Button>
        </div>
      )}
      {!canWrite && (
        <Explainer>
          You can view this user but not edit them — that needs the <code>identity.user.write</code>{' '}
          permission.
        </Explainer>
      )}

      {/* key on version: a reload or a successful save hands the form fresh values */}
      <ProfileCard key={`profile-${user.version}`} user={user} canWrite={canWrite} onError={fail} />
      <RolesCard user={user} canWrite={canWrite} onError={fail} />
      {canSuspend && <LifecycleCard user={user} onError={fail} />}
    </div>
  )
}

interface CardProps {
  user: User
  onError: (error: unknown) => void
}

function ProfileCard({ user, canWrite, onError }: CardProps & { canWrite: boolean }) {
  const update = useUpdateUserMutation(user.id!)
  const [name, setName] = React.useState(user.name ?? '')
  const [email, setEmail] = React.useState(user.email ?? '')
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  function save(event: React.FormEvent) {
    event.preventDefault()
    setFieldErrors({})
    update
      .mutateAsync({
        name: name.trim(),
        email: email.trim() || undefined,
        // The update contract requires `mobile`. It is sent back exactly as loaded: this screen
        // never changes identity (see the Status block's contract question).
        mobile: user.mobile!,
        version: user.version!,
      })
      .then(() => toast.success('Profile saved'))
      .catch((error) => {
        if (
          isApiError(error) &&
          (error.code === 'VALIDATION_FAILED' || error.code === 'CONFLICT') &&
          error.fieldErrors.length > 0
        ) {
          setFieldErrors(Object.fromEntries(error.fieldErrors.map((f) => [f.field, f.message])))
        } else {
          onError(error)
        }
      })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Name and email can be edited.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="user-mobile">Mobile (identity)</Label>
            <Input
              id="user-mobile"
              className="font-mono"
              value={user.mobile ?? ''}
              readOnly
              disabled
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="user-name">Name</Label>
            <Input
              id="user-name"
              value={name}
              disabled={!canWrite}
              onChange={(e) => setName(e.target.value)}
            />
            {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              disabled={!canWrite}
              onChange={(e) => setEmail(e.target.value)}
            />
            {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
          </div>
          {fieldErrors.mobile && <p className="text-sm text-destructive">{fieldErrors.mobile}</p>}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <dt>Claimed</dt>
            <dd>
              {user.activatedAt
                ? formatDate(user.activatedAt)
                : 'Not yet — the person has not claimed this account'}
            </dd>
            <dt>Created</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </dl>
          <div>
            <Button type="submit" disabled={!canWrite || update.isPending || name.trim() === ''}>
              Save profile
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function GrantHistory({ history }: { history: RoleGrant[] }) {
  const partner = history.filter((g) => g.role === 'PARTNER')
  if (partner.length === 0) {
    return <p className="text-sm text-muted-foreground">No partner history.</p>
  }
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {partner.map((grant, index) => (
        <li key={`${grant.grantedAt}-${index}`} className="flex flex-wrap gap-x-2">
          <span className="font-medium">Partner</span>
          <span className="text-muted-foreground">granted {formatDate(grant.grantedAt)}</span>
          {grant.revokedAt ? (
            <span className="text-destructive">· revoked {formatDate(grant.revokedAt)}</span>
          ) : (
            <span className="text-muted-foreground">· current</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function RolesCard({ user, canWrite, onError }: CardProps & { canWrite: boolean }) {
  const action = useUserActionMutation(user.id!)
  const isPartner = (user.roles ?? []).includes('PARTNER')

  function run(kind: 'grant-partner' | 'revoke-partner') {
    action
      .mutateAsync({ action: kind, version: user.version! })
      .then(() => toast.success(kind === 'grant-partner' ? 'Partner granted' : 'Partner revoked'))
      .catch(onError)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <CardDescription>
          Every customer is a Consumer. Partner is an extra flag on this same account — never a
          second account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserRoleBadges roles={user.roles} />
          </div>
          {isPartner ? (
            <Button
              variant="outline"
              disabled={!canWrite || action.isPending}
              onClick={() => run('revoke-partner')}
            >
              Revoke Partner
            </Button>
          ) : (
            <Button disabled={!canWrite || action.isPending} onClick={() => run('grant-partner')}>
              Grant Partner
            </Button>
          )}
        </div>
        <Explainer>
          {isPartner
            ? 'Revoking closes the partner grant and keeps it in the history below; the account stays a Consumer.'
            : 'Granting Partner is just a flag. It captures no KYC, bank or commission details — those come with payouts.'}
        </Explainer>
        <div className="grid gap-1">
          <Label>Partner history</Label>
          <GrantHistory history={user.roleHistory ?? []} />
        </div>
      </CardContent>
    </Card>
  )
}

function LifecycleCard({ user, onError }: CardProps) {
  const action = useUserActionMutation(user.id!)
  const [confirm, setConfirm] = React.useState<'suspend' | 'reinstate' | undefined>()
  const claimed = !!user.activatedAt
  const reinstateTarget = claimed ? 'Active' : 'Invited'

  function run() {
    if (!confirm) {
      return
    }
    const kind = confirm
    action
      .mutateAsync({ action: kind, version: user.version! })
      .then((updated) => {
        const resulting =
          updated.status === 'ACTIVE'
            ? 'Active'
            : updated.status === 'INVITED'
              ? 'Invited'
              : 'Suspended'
        toast.success(
          kind === 'suspend' ? 'Account suspended' : `Account reinstated — now ${resulting}`
        )
      })
      .catch(onError)
      .finally(() => setConfirm(undefined))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account status</CardTitle>
        <CardDescription>
          A suspended account can no longer transact. Suspending is reversible.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {user.status === 'SUSPENDED' ? (
          <>
            <Explainer>
              Reinstating returns this account to where it was:{' '}
              {claimed
                ? 'the person had claimed it, so it goes back to Active.'
                : 'the person never claimed it, so it goes back to Invited — reinstating never activates an unclaimed account.'}
            </Explainer>
            <div>
              <Button onClick={() => setConfirm('reinstate')}>Reinstate</Button>
            </div>
          </>
        ) : (
          <div>
            <Button variant="outline" onClick={() => setConfirm('suspend')}>
              Suspend
            </Button>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title={confirm === 'suspend' ? 'Suspend account' : 'Reinstate account'}
        confirmLabel={confirm === 'suspend' ? 'Suspend' : 'Reinstate'}
        destructive={confirm === 'suspend'}
        pending={action.isPending}
        onConfirm={run}
      >
        {confirm === 'suspend' ? (
          <p>
            {user.name} ({user.mobile}) will no longer be able to transact until reinstated.
          </p>
        ) : (
          <p>
            {user.name} ({user.mobile}) will return to <strong>{reinstateTarget}</strong>.
          </p>
        )}
      </ConfirmDialog>
    </Card>
  )
}

export default UserDetailPage
