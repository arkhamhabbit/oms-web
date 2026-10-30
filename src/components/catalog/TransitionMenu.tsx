import * as React from 'react'
import { ChevronDownIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toastApiError } from '@/lib/api-error'
import {
  availableCatalogTransitions,
  TRANSITION_DONE,
  type CatalogStatus,
  type CatalogTransitionAction,
} from '@/lib/catalog-transitions'

export interface TransitionMenuProps {
  status: CatalogStatus
  live: boolean
  /** Convenience-only gate (D2.17) — the server rejects the call regardless of this prop. */
  canPublish: boolean
  /** What this is, lower-case ("category", "brand"), and its name: the toast and the confirm use them. */
  noun: string
  name: string
  /** What archiving it means, for the confirm. Archive is one-way, so it always asks. */
  archiveConsequence: string
  onTransition: (action: CatalogTransitionAction) => Promise<unknown>
}

/**
 * D4.16: renders only the transitions valid from the current state — never a greyed-out button
 * for one that isn't ("worse than no button" per the task). Missing the publish permission
 * disables the whole control instead, since that's a different reason than "not applicable here".
 * Archive is one-way, so it names its consequence and waits for a confirm; every transition that
 * goes through says so in a toast.
 */
function TransitionMenu({
  status,
  live,
  canPublish,
  noun,
  name,
  archiveConsequence,
  onTransition,
}: TransitionMenuProps) {
  const [pending, setPending] = React.useState(false)
  const [confirmArchive, setConfirmArchive] = React.useState(false)
  const transitions = availableCatalogTransitions(status, live)

  if (transitions.length === 0) {
    return null
  }

  async function run(action: CatalogTransitionAction) {
    setPending(true)
    try {
      await onTransition(action)
      toast.success(`${name} ${TRANSITION_DONE[action]}`)
    } catch (error) {
      toastApiError(error)
    } finally {
      setPending(false)
      setConfirmArchive(false)
    }
  }

  function handleSelect(action: CatalogTransitionAction) {
    if (action === 'archive') {
      setConfirmArchive(true)
      return
    }
    void run(action)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={!canPublish || pending}
            title={canPublish ? undefined : 'Requires the publish permission'}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Actions
            <ChevronDownIcon className="opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {transitions.map(({ action, label }) => (
            <DropdownMenuItem key={action} onSelect={() => handleSelect(action)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive this ${noun}`}
        confirmLabel="Archive"
        destructive
        pending={pending}
        onConfirm={() => void run('archive')}
      >
        <p>
          {name}: {archiveConsequence}
        </p>
      </ConfirmDialog>
    </>
  )
}

export { TransitionMenu }
