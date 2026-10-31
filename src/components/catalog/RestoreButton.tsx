import * as React from 'react'
import { ArchiveRestoreIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RefusalText } from '@/components/common/RefusalText'
import { Button } from '@/components/ui/button'
import { ARCHIVED_NOTICE, canRestore, restorePrompt } from '@/lib/catalog-transitions'
import { toRefusal, type Refusal } from '@/lib/refusal'

export interface RestoreButtonProps {
  status: string | undefined
  /** Convenience-only gate (D2.17): the entity's publish key, the one that archives it. */
  canPublish: boolean
  noun: string
  name: string
  /** Sends the restore with the `version` the caller read. Rejects with the server's refusal. */
  onRestore: () => Promise<unknown>
  className?: string
}

/**
 * D4.23: the one action an archived brand, category or product has. Shown only for ARCHIVED and
 * only to an account that could archive it. The confirm says the item comes back Active and stays
 * off sale; a refusal ("Restore the parent category first.") is the server's own sentence, placed
 * beside the button rather than in a toast that disappears.
 */
function RestoreButton({
  status,
  canPublish,
  noun,
  name,
  onRestore,
  className,
}: RestoreButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [refusal, setRefusal] = React.useState<Refusal | undefined>(undefined)

  if (!canRestore(status, canPublish)) {
    return null
  }

  async function confirm() {
    setPending(true)
    setRefusal(undefined)
    try {
      await onRestore()
      toast.success(`${name} restored — it is Active and off sale`)
    } catch (error) {
      setRefusal(toRefusal(error, `This ${noun}`))
    } finally {
      setPending(false)
      setOpen(false)
    }
  }

  return (
    <div className={className}>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => setOpen(true)}>
        {pending ? <Loader2Icon className="animate-spin" /> : <ArchiveRestoreIcon />}
        Restore
      </Button>
      <RefusalText refusal={refusal} id={`restore-refusal-${noun}`} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Restore this ${noun}`}
        confirmLabel="Restore"
        pending={pending}
        onConfirm={() => void confirm()}
      >
        <p>{restorePrompt(name)}</p>
      </ConfirmDialog>
    </div>
  )
}

/** The line on an archived item's page: its edit controls are disabled, Restore is the way back. */
function ArchivedNotice({ className }: { className?: string }) {
  return (
    <p role="status" className={className ?? 'text-sm text-muted-foreground'}>
      {ARCHIVED_NOTICE}
    </p>
  )
}

export { RestoreButton, ArchivedNotice }
