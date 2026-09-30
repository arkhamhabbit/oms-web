import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftIcon, InfoIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/form/MultiSelect'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { NoticeBanner, noticeFromError, type Notice } from '@/components/common/NoticeBanner'
import { LinkDialog } from '@/components/team/LinkDialog'
import { MemberStatusBadge } from '@/components/team/MemberStatusBadge'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { useProfileQuery } from '@/api/auth'
import { useRolesQuery } from '@/api/roles'
import {
  useAssignRolesMutation,
  useForceLogoutMutation,
  useMemberStatusMutation,
  useResendInviteMutation,
  useResetPasswordMutation,
  useTeamMemberQuery,
  useUpdateTeamMemberMutation,
  type MemberStatusAction,
  type TeamMember,
} from '@/api/team'
import { isApiError } from '@/lib/api-error'

function ReadOnlyReason({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
      <InfoIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

const STATUS_CONFIRM: Record<
  MemberStatusAction,
  { title: string; label: string; destructive: boolean; body: (name: string) => React.ReactNode }
> = {
  suspend: {
    title: 'Suspend member',
    label: 'Suspend',
    destructive: true,
    body: (name) => (
      <p>
        {name} will be signed out everywhere immediately and cannot sign in until reactivated. Their
        roles are kept — activating them later puts them back as they were.
      </p>
    ),
  },
  deactivate: {
    title: 'Deactivate member',
    label: 'Deactivate',
    destructive: true,
    body: (name) => (
      <p>
        {name} is offboarded: every session is revoked at once and they cannot sign in. Their audit
        history stays. A deactivated member can be activated again.
      </p>
    ),
  },
  activate: {
    title: 'Activate member',
    label: 'Activate',
    destructive: false,
    body: (name) => (
      <p>
        {name} can sign in again with the roles they were left with. Reinstating does not restore
        any access that was removed separately.
      </p>
    ),
  },
}

function TeamMemberPage() {
  const { id = '' } = useParams()
  const { has } = usePermissions()
  const canManage = has('team.manage')
  const profile = useProfileQuery()
  const memberQuery = useTeamMemberQuery(id)
  const member = memberQuery.data

  useBreadcrumb([{ label: 'Team', to: '/team' }, { label: member?.name ?? 'Member' }])

  const [notice, setNotice] = React.useState<Notice | undefined>()

  function fail(error: unknown) {
    setNotice(noticeFromError(error, 'This member'))
  }
  function reload() {
    setNotice(undefined)
    void memberQuery.refetch()
  }

  if (memberQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (memberQuery.isError || !member) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <p className="text-sm">
          {isApiError(memberQuery.error)
            ? memberQuery.error.message
            : 'This member could not be loaded.'}
        </p>
      </div>
    )
  }

  const isSelf = profile.data?.id === member.id

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <BackLink />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{member.name}</h1>
        <MemberStatusBadge status={member.status} locked={member.locked} />
        {isSelf && <Badge variant="outline">You</Badge>}
      </div>

      {notice && (
        <NoticeBanner
          notice={notice}
          onReload={reload}
          onDismiss={() => setNotice(undefined)}
        />
      )}
      {!canManage && (
        <ReadOnlyReason>
          You can view this member but not change them — that needs the <code>team.manage</code>{' '}
          permission.
        </ReadOnlyReason>
      )}

      {/* key on version: a reload or a successful save hands the forms fresh values and version */}
      <ProfileCard
        key={`profile-${member.version}`}
        member={member}
        canManage={canManage}
        onError={fail}
      />
      <RolesCard
        key={`roles-${member.version}`}
        member={member}
        canManage={canManage}
        isSelf={isSelf}
        onError={fail}
      />
      <StatusCard member={member} canManage={canManage} isSelf={isSelf} onError={fail} />
      <SecurityCard member={member} canManage={canManage} onError={fail} />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/team"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" /> Team
    </Link>
  )
}

interface CardProps {
  member: TeamMember
  canManage: boolean
  onError: (error: unknown) => void
}

function ProfileCard({ member, canManage, onError }: CardProps) {
  const update = useUpdateTeamMemberMutation(member.id!)
  const [name, setName] = React.useState(member.name ?? '')
  const [phone, setPhone] = React.useState(member.phone ?? '')
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  function save(event: React.FormEvent) {
    event.preventDefault()
    setFieldErrors({})
    update
      .mutateAsync({
        name: name.trim(),
        phone: phone.trim() || undefined,
        version: member.version!,
      })
      .then(() => toast.success('Profile saved'))
      .catch((error) => {
        if (isApiError(error) && error.code === 'VALIDATION_FAILED' && error.fieldErrors.length) {
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
        <CardDescription>Email is the sign-in identity and cannot be changed.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="member-name">Name</Label>
            <Input
              id="member-name"
              value={name}
              disabled={!canManage}
              onChange={(e) => setName(e.target.value)}
            />
            {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="member-email">Email</Label>
            <Input id="member-email" value={member.email ?? ''} disabled readOnly />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="member-phone">Phone</Label>
            <Input
              id="member-phone"
              value={phone}
              disabled={!canManage}
              onChange={(e) => setPhone(e.target.value)}
            />
            {fieldErrors.phone && <p className="text-sm text-destructive">{fieldErrors.phone}</p>}
          </div>
          <div>
            <Button type="submit" disabled={!canManage || update.isPending || name.trim() === ''}>
              Save profile
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function RolesCard({ member, canManage, isSelf, onError }: CardProps & { isSelf: boolean }) {
  const roles = useRolesQuery()
  const assign = useAssignRolesMutation(member.id!)
  const [roleIds, setRoleIds] = React.useState<string[]>((member.roles ?? []).map((r) => r.id!))

  const original = (member.roles ?? []).map((r) => r.id!)
  const dirty =
    roleIds.length !== original.length || roleIds.some((roleId) => !original.includes(roleId))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <CardDescription>
          What this person can do is the union of their roles&apos; permissions. There are no
          per-member grants.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isSelf ? (
          <>
            <ReadOnlyReason>
              You can&apos;t change your own roles — nobody grants themselves access, Super Admins
              included. Ask another administrator.
            </ReadOnlyReason>
            <div className="flex flex-wrap gap-1">
              {(member.roles ?? []).map((r) => (
                <Badge key={r.id} variant={r.systemRole ? 'default' : 'secondary'}>
                  {r.name}
                </Badge>
              ))}
            </div>
          </>
        ) : (
          <>
            <MultiSelect
              options={(roles.data ?? []).map((r) => ({ value: r.id!, label: r.name! }))}
              value={roleIds}
              onValueChange={setRoleIds}
              placeholder="No roles"
              className={canManage ? undefined : 'pointer-events-none opacity-60'}
            />
            <div>
              <Button
                disabled={!canManage || !dirty || assign.isPending}
                onClick={() =>
                  assign
                    .mutateAsync({ roleIds, version: member.version! })
                    .then(() => toast.success('Roles updated'))
                    .catch(onError)
                }
              >
                Save roles
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function StatusCard({ member, canManage, isSelf, onError }: CardProps & { isSelf: boolean }) {
  const mutation = useMemberStatusMutation(member.id!)
  const [pending, setPending] = React.useState<MemberStatusAction | undefined>()
  const name = member.name ?? 'This member'

  const actions: MemberStatusAction[] =
    member.status === 'ACTIVE' || member.status === 'INVITED'
      ? ['suspend', 'deactivate']
      : member.status === 'SUSPENDED'
        ? ['activate', 'deactivate']
        : ['activate']

  function run() {
    if (!pending) {
      return
    }
    mutation
      .mutateAsync(pending)
      .then(() => toast.success(`Member ${pending}d`))
      .catch(onError)
      .finally(() => setPending(undefined))
  }

  const cfg = pending ? STATUS_CONFIRM[pending] : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account status</CardTitle>
        <CardDescription>
          Suspend is the reversible one; deactivate is offboarding. Neither deletes anything — audit
          history refers to this person.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isSelf && (
          <ReadOnlyReason>
            You can&apos;t suspend or deactivate your own account. The last active Super Admin can
            never be suspended or deactivated either — someone has to be able to administer.
          </ReadOnlyReason>
        )}
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              variant={action === 'activate' ? 'default' : 'outline'}
              disabled={!canManage || (isSelf && action !== 'activate')}
              onClick={() => setPending(action)}
            >
              {STATUS_CONFIRM[action].label}
            </Button>
          ))}
        </div>
      </CardContent>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(undefined)}
        title={cfg?.title ?? ''}
        confirmLabel={cfg?.label ?? ''}
        destructive={cfg?.destructive}
        pending={mutation.isPending}
        onConfirm={run}
      >
        {cfg?.body(name)}
      </ConfirmDialog>
    </Card>
  )
}

function SecurityCard({
  member,
  canManage,
  onError,
}: Omit<CardProps, 'member'> & { member: TeamMember }) {
  const forceLogout = useForceLogoutMutation(member.id!)
  const resetPassword = useResetPasswordMutation(member.id!)
  const resendInvite = useResendInviteMutation(member.id!)
  const [confirm, setConfirm] = React.useState<'logout' | 'reset' | undefined>()
  const [link, setLink] = React.useState<{ kind: 'reset' | 'invite'; url?: string } | undefined>()
  const name = member.name ?? 'This member'
  const invited = member.status === 'INVITED'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions &amp; password</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!canManage} onClick={() => setConfirm('logout')}>
          Force logout
        </Button>
        {invited ? (
          <Button
            variant="outline"
            disabled={!canManage || resendInvite.isPending}
            onClick={() =>
              resendInvite
                .mutateAsync()
                .then((r) => setLink({ kind: 'invite', url: r.inviteLink }))
                .catch(onError)
            }
          >
            Resend invite
          </Button>
        ) : (
          <Button variant="outline" disabled={!canManage} onClick={() => setConfirm('reset')}>
            Reset password
          </Button>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirm === 'logout'}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title="Force logout"
        confirmLabel="Force logout"
        destructive
        pending={forceLogout.isPending}
        onConfirm={() =>
          forceLogout
            .mutateAsync()
            .then((r) =>
              toast.success(
                r.sessionsRevoked === 0
                  ? `${name} had no active sessions.`
                  : `${r.sessionsRevoked} session${r.sessionsRevoked === 1 ? '' : 's'} revoked.`
              )
            )
            .catch(onError)
            .finally(() => setConfirm(undefined))
        }
      >
        <p>
          Every session {name} holds is revoked; their next request fails and they are signed out.
          Their status doesn&apos;t change — they can sign in again straight away. To stop them
          signing in, suspend or deactivate instead.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'reset'}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title="Reset password"
        confirmLabel="Start reset"
        destructive
        pending={resetPassword.isPending}
        onConfirm={() =>
          resetPassword
            .mutateAsync()
            .then((r) => setLink({ kind: 'reset', url: r.resetLink }))
            .catch(onError)
            .finally(() => setConfirm(undefined))
        }
      >
        <p>This does three things:</p>
        <ul className="list-disc pl-5">
          <li>generates a one-time reset link for {name};</li>
          <li>revokes every session they hold, signing them out now;</li>
          <li>you never see or choose their new password — they set it themselves via the link.</li>
        </ul>
      </ConfirmDialog>

      <LinkDialog
        open={link !== undefined}
        onOpenChange={(open) => !open && setLink(undefined)}
        title={link?.kind === 'invite' ? 'New invite link' : 'Password reset link'}
        link={link?.url}
        description={
          link?.kind === 'invite' ? (
            <p>
              A fresh invite link was issued for {name}; any previous link no longer works. Email is
              not wired yet, so hand them this one.
            </p>
          ) : (
            <p>
              A reset was started for {name} and their sessions were revoked. Email is not wired
              yet, so hand them this link — they use it to choose a new password.
            </p>
          )
        }
      />
    </Card>
  )
}

export default TeamMemberPage
