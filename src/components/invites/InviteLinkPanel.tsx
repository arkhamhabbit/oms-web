import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { Invite } from '@/api/invites'

function copy(text: string, what: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${what} copied`))
    .catch(() =>
      toast.error(`Could not copy the ${what.toLowerCase()} — select it and copy by hand.`)
    )
}

/** OMS sends nothing: the admin shares the join link and pre-filled message themselves. */
function InviteLinkPanel({ invite }: { invite: Invite }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3 text-sm">
      <div className="flex flex-col gap-1">
        <span className="font-medium">Join link</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{invite.link}</code>
          <Button size="sm" variant="outline" onClick={() => copy(invite.link ?? '', 'Link')}>
            <CopyIcon /> Copy
          </Button>
        </div>
      </div>
      {invite.shareMessage && (
        <div className="flex flex-col gap-1">
          <span className="font-medium">Message to send</span>
          <p className="rounded bg-muted px-2 py-1 text-xs whitespace-pre-wrap">
            {invite.shareMessage}
          </p>
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(invite.shareMessage ?? '', 'Message')}
            >
              <CopyIcon /> Copy message
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Nothing has been sent — share this yourself. Valid until{' '}
        {invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : '—'}.
      </p>
    </div>
  )
}

export { InviteLinkPanel }
