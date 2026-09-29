import * as React from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface LinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** What the link is and what has already happened as a side effect. */
  description: React.ReactNode
  link: string | undefined
}

/**
 * Shows a one-time link the API returns in place of email (email is not wired yet). The link
 * exists in that one response and nowhere else, so it is copyable here and gone once closed.
 */
function LinkDialog({ open, onOpenChange, title, description, link }: LinkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">{description}</div>
          </DialogDescription>
        </DialogHeader>
        <CopyableLink link={link} />
        <p className="text-xs text-muted-foreground">
          This link is shown once. Closing this dialog does not lose the member — a fresh link can
          be issued — but this one will not be shown again.
        </p>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Mounted only while the dialog is open, so "copied" starts false on every open.
function CopyableLink({ link }: { link: string | undefined }) {
  const [copied, setCopied] = React.useState(false)

  function copy() {
    if (!link) {
      return
    }
    navigator.clipboard
      .writeText(link)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }

  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={link ?? ''} aria-label="Link" onFocus={(e) => e.target.select()} />
      <Button variant="outline" size="icon" onClick={copy} title="Copy link">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}

export { LinkDialog }
