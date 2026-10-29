import * as React from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RefusalText } from '@/components/common/RefusalText'
import { Button } from '@/components/ui/button'
import { toRefusal, type Refusal } from '@/lib/refusal'

/**
 * Deactivate / Reactivate behind a confirm. The server's refusal (a warehouse still holding stock,
 * a supplier with open orders) stays in the dialog in its own words, naming the count.
 */
function ActiveToggle({
  noun,
  name,
  active,
  allowed,
  permission,
  deactivateWarning,
  onToggle,
}: {
  noun: 'warehouse' | 'supplier'
  name: string
  active: boolean
  allowed: boolean
  permission: string
  deactivateWarning: string
  onToggle: (action: 'deactivate' | 'reactivate') => Promise<unknown>
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()
  const action = active ? 'deactivate' : 'reactivate'

  function confirm() {
    setRefusal(undefined)
    setPending(true)
    onToggle(action)
      .then(() => {
        toast.success(active ? `${name} deactivated` : `${name} reactivated`)
        setOpen(false)
      })
      .catch((error) => setRefusal(toRefusal(error, `This ${noun}`)))
      .finally(() => setPending(false))
  }

  return (
    <>
      <Button
        variant="outline"
        disabled={!allowed}
        title={allowed ? undefined : `Needs ${permission}`}
        onClick={() => {
          setRefusal(undefined)
          setOpen(true)
        }}
      >
        {active ? 'Deactivate' : 'Reactivate'}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={active ? `Deactivate this ${noun}` : `Reactivate this ${noun}`}
        confirmLabel={active ? 'Deactivate' : 'Reactivate'}
        destructive={active}
        pending={pending}
        onConfirm={confirm}
      >
        <p>
          {active ? deactivateWarning : `${name} goes back into use and appears in pickers again.`}
        </p>
        <RefusalText refusal={refusal} />
      </ConfirmDialog>
    </>
  )
}

export { ActiveToggle }
