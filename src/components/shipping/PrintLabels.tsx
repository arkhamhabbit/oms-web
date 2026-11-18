import * as React from 'react'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { noticeFromError } from '@/components/common/NoticeBanner'
import { usePrintLabelsMutation, useResolveLiveShipments } from '@/api/shipping'
import { listInWords, openPrintTab } from '@/lib/shipping'

export interface PrintOutcome {
  /** The server's sentence (or why nothing was asked): nothing was printed. */
  refusal?: string
  /** The merged file, for a second look or when the browser blocked the tab. */
  url?: string
  count?: number
  blocked?: boolean
}

export type PrintTarget = { shipmentIds: string[] } | { orderNumbers: string[] }

/**
 * Print labels as one merged PDF, all or nothing. The tab is opened inside the click, so no popup
 * blocker stops it, then filled with the PDF — or closed, and the server's sentence naming the
 * order is shown instead. Resolves true when the file printed.
 */
export function usePrintLabels() {
  const resolve = useResolveLiveShipments()
  const print = usePrintLabelsMutation()
  const [outcome, setOutcome] = React.useState<PrintOutcome | undefined>()
  const [pending, setPending] = React.useState(false)

  async function run(target: PrintTarget): Promise<boolean> {
    const tab = openPrintTab()
    setPending(true)
    try {
      let ids: string[]
      if ('orderNumbers' in target) {
        const live = await resolve(target.orderNumbers)
        const unbooked = live.filter((l) => !l.shipment).map((l) => l.orderNumber)
        if (unbooked.length > 0) {
          tab.close()
          setOutcome({
            refusal: `Nothing was printed: ${listInWords(unbooked)} ${unbooked.length === 1 ? 'has' : 'have'} no booked shipment.`,
          })
          return false
        }
        ids = live.map((l) => l.shipment!.id!)
      } else {
        ids = target.shipmentIds
      }
      const blob = await print.mutateAsync(ids)
      const url = tab.show(blob)
      setOutcome({ url, count: ids.length, blocked: tab.blocked })
      return true
    } catch (error) {
      tab.close()
      setOutcome({ refusal: noticeFromError(error, 'These labels').text })
      return false
    } finally {
      setPending(false)
    }
  }

  return { run, pending, outcome, clear: () => setOutcome(undefined) }
}

/** What came of a print: the server's refusal (nothing printed), or the file with a link to it. */
export function PrintOutcomeDialog({
  outcome,
  onClose,
}: {
  outcome: PrintOutcome | undefined
  onClose: () => void
}) {
  return (
    <ConfirmDialog
      open={!!outcome}
      onOpenChange={(open) => !open && onClose()}
      title={outcome?.refusal ? 'Labels not printed' : 'Labels ready'}
      confirmLabel="Close"
      onConfirm={onClose}
    >
      {outcome?.refusal ? (
        <p role="alert" className="text-destructive">
          {outcome.refusal}
        </p>
      ) : (
        <p>
          {outcome?.count} {outcome?.count === 1 ? 'label' : 'labels'} in one file
          {outcome?.blocked ? '. The browser blocked the new tab: ' : ', opened in a new tab. '}
          {outcome?.url && (
            <a href={outcome.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              Open the labels
            </a>
          )}
        </p>
      )}
    </ConfirmDialog>
  )
}
