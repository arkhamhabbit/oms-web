import * as React from 'react'
import { ChevronDownIcon, Loader2Icon } from 'lucide-react'

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
  type CatalogStatus,
  type CatalogTransitionAction,
} from '@/lib/catalog-transitions'

export interface TransitionMenuProps {
  status: CatalogStatus
  live: boolean
  /** Convenience-only gate (D2.17) — the server rejects the call regardless of this prop. */
  canPublish: boolean
  onTransition: (action: CatalogTransitionAction) => Promise<unknown>
}

/**
 * D4.16: renders only the transitions valid from the current state — never a greyed-out button
 * for one that isn't ("worse than no button" per the task). Missing the publish permission
 * disables the whole control instead, since that's a different reason than "not applicable here".
 */
function TransitionMenu({ status, live, canPublish, onTransition }: TransitionMenuProps) {
  const [pending, setPending] = React.useState(false)
  const transitions = availableCatalogTransitions(status, live)

  if (transitions.length === 0) {
    return null
  }

  async function handleSelect(action: CatalogTransitionAction) {
    setPending(true)
    try {
      await onTransition(action)
    } catch (error) {
      toastApiError(error)
    } finally {
      setPending(false)
    }
  }

  return (
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
  )
}

export { TransitionMenu }
