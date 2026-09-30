import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NoticeBanner, noticeFromError, type Notice } from '@/components/common/NoticeBanner'
import { InviteLinkPanel } from '@/components/invites/InviteLinkPanel'
import { INVITE_STATUS, InviteStatusBadge } from '@/components/invites/InviteStatusBadge'
import { useInvalidateInviteMutation, useInviteQuery, type Invite } from '@/api/invites'

function formatDate(value: string | undefined) {
  return value ? new Date(value).toLocaleString() : undefined
}

/** Only an open invite (not yet claimed, expired or invalid) can be marked INVALID. */
function isOpen(invite: Invite) {
  return invite.status === 'PENDING' || invite.status === 'VISITED'
}

function InviteDetailDialog({
  inviteId,
  canWrite,
  onOpenChange,
}: {
  inviteId: string | undefined
  canWrite: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!inviteId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {inviteId && <Detail inviteId={inviteId} canWrite={canWrite} />}
      </DialogContent>
    </Dialog>
  )
}

function Detail({ inviteId, canWrite }: { inviteId: string; canWrite: boolean }) {
  const query = useInviteQuery(inviteId)
  const invite = query.data
  const invalidate = useInvalidateInviteMutation(inviteId)
  const [reason, setReason] = React.useState('')
  const [notice, setNotice] = React.useState<Notice | undefined>()

  if (query.isLoading || !invite) {
    return (
      <DialogHeader>
        <DialogTitle>Invite</DialogTitle>
        <DialogDescription>
          {query.isError ? 'This invite could not be loaded.' : 'Loading…'}
        </DialogDescription>
      </DialogHeader>
    )
  }

  function markInvalid() {
    setNotice(undefined)
    invalidate
      .mutateAsync(reason.trim())
      .then(() => {
        toast.success('Invite marked invalid')
        setReason('')
      })
      .catch((error) => setNotice(noticeFromError(error, 'This invite')))
  }

  const timeline: [string, string | undefined][] = [
    ['Issued', formatDate(invite.issuedAt)],
    ['Link opened', formatDate(invite.visitedAt)],
    ['Claimed', formatDate(invite.addedAt)],
    ['Closed', formatDate(invite.closedAt)],
    ['Expires', formatDate(invite.expiresAt)],
  ]

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="font-mono">{invite.mobile}</span>
          <InviteStatusBadge status={invite.status} />
        </DialogTitle>
        <DialogDescription>
          {invite.status && INVITE_STATUS[invite.status].help}{' '}
          {invite.issuerKind === 'INSIDER' ? (
            <>
              Issued by an{' '}
              <Link to={`/users/${invite.issuedByUser}`} className="underline underline-offset-2">
                Insider
              </Link>
              .
            </>
          ) : (
            <>
              Issued by an{' '}
              <Link to={`/team/${invite.issuedByMember}`} className="underline underline-offset-2">
                admin
              </Link>
              .
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      {notice && (
        <NoticeBanner
          notice={notice}
          onReload={() => {
            setNotice(undefined)
            void query.refetch()
          }}
          onDismiss={() => setNotice(undefined)}
        />
      )}

      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
        {timeline
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </React.Fragment>
          ))}
        {invite.invalidReason && (
          <>
            <dt className="text-muted-foreground">Invalid because</dt>
            <dd>{invite.invalidReason}</dd>
          </>
        )}
        {invite.inviteeUserId && (
          <>
            <dt className="text-muted-foreground">Account</dt>
            <dd>
              <Link to={`/users/${invite.inviteeUserId}`} className="underline underline-offset-2">
                Open the account
              </Link>
            </dd>
          </>
        )}
      </dl>

      {isOpen(invite) && <InviteLinkPanel invite={invite} />}

      {isOpen(invite) && canWrite && (
        <div className="flex flex-col gap-1.5 border-t pt-4">
          <Label htmlFor="invalid-reason">Mark invalid</Label>
          <Input
            id="invalid-reason"
            placeholder="Why — e.g. number unreachable"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            For a number that is wrong or unreachable. Invalid is final — the link stops working.
          </p>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!reason.trim() || invalidate.isPending}
              onClick={markInvalid}
            >
              Mark invalid
            </Button>
          </DialogFooter>
        </div>
      )}
    </>
  )
}

export { InviteDetailDialog }
