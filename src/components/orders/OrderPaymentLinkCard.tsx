import * as React from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { toast } from 'sonner'

import { useIssuePaymentLinkMutation, type OrderDetail, type PaymentLink } from '@/api/orders'
import { usePermissions } from '@/auth/usePermissions'
import { RefusalText } from '@/components/common/RefusalText'
import { MarkPaidDialog } from '@/components/orders/MarkPaidDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isVersionConflict } from '@/lib/api-error'
import { formatDateTime } from '@/lib/dates'
import { labelOf, PAYMENT_LINK_STATUS_LABEL } from '@/lib/labels'
import {
  canIssueLink,
  canMarkPaid,
  countdown,
  CREATE_ORDER_PERMISSION,
  earlierLinks,
  isTeamOrder,
  liveLink,
  MARK_PAID_PERMISSION,
} from '@/lib/orders'
import { toRefusal, type Refusal } from '@/lib/refusal'
import { useNow } from '@/lib/use-debounced'

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label="Copy payment link"
      onClick={() => {
        void navigator.clipboard?.writeText(url).then(
          () => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          },
          () => undefined
        )
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />} {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

/** What happened to the link at the gateway when it was cancelled: done, still asking, or refused. */
function CancelNote({ link }: { link: PaymentLink }) {
  if (link.lastCancelError && !link.cancelledAt) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Cancelling this link at Razorpay failed: {link.lastCancelError} OMS asks again by itself.
      </p>
    )
  }
  if (link.cancelRequestedAt && !link.cancelledAt && link.status !== 'EXPIRED') {
    return (
      <p className="text-sm text-muted-foreground">
        Cancelling at Razorpay requested {formatDateTime(link.cancelRequestedAt)}; waiting for the
        gateway to confirm.
      </p>
    )
  }
  return null
}

function LinkFacts({ link, now }: { link: PaymentLink; now: number }) {
  const live = link.status === 'ISSUED'
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <Badge variant={live ? 'default' : 'outline'}>
            {labelOf(PAYMENT_LINK_STATUS_LABEL, link.status)}
          </Badge>
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{live ? 'Expires' : link.status === 'PAID' ? 'Paid' : 'Ended'}</dt>
        <dd className="font-medium">
          {live ? (
            <>
              <span data-testid="link-countdown">{countdown(link.expiresAt, now)}</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {formatDateTime(link.expiresAt)}
              </span>
            </>
          ) : (
            formatDateTime(link.paidAt ?? link.cancelledAt ?? link.expiredAt ?? link.expiresAt)
          )}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Texted to the member</dt>
        <dd className="font-medium">{link.notifyCustomer ? 'Yes' : 'No — shared by the team'}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Issued</dt>
        <dd className="font-medium">
          {formatDateTime(link.issuedAt)}
          {link.issuedByName ? ` by ${link.issuedByName}` : ''}
        </dd>
      </div>
    </dl>
  )
}

/**
 * The payment link of an order the team placed (D9.9): the live link to copy and share, how long it
 * has, earlier links, and the two ways forward while the order is unpaid: a new link, or Mark as paid.
 * Shown for a team order that has a link or is still waiting for payment.
 */
function OrderPaymentLinkCard({ order, onStale }: { order: OrderDetail; onStale: () => void }) {
  const { has } = usePermissions()
  const now = useNow()
  const issue = useIssuePaymentLinkMutation(order.id!)
  const [refusal, setRefusal] = React.useState<Refusal | undefined>()
  const [paying, setPaying] = React.useState(false)
  if (!isTeamOrder(order)) {
    return null
  }
  const live = liveLink(order)
  const earlier = earlierLinks(order)
  const awaiting = order.status === 'PENDING_PAYMENT'
  if (!awaiting && !live && earlier.length === 0) {
    return null
  }
  const mayIssue = has(CREATE_ORDER_PERMISSION)
  const mayMarkPaid = has(MARK_PAID_PERMISSION)

  function issueLink() {
    setRefusal(undefined)
    issue
      .mutateAsync({ version: order.version!, idempotencyKey: crypto.randomUUID() })
      .then(() => toast.success('Payment link issued'))
      .catch((error) => {
        setRefusal(toRefusal(error, 'This order'))
        if (isVersionConflict(error)) {
          onStale()
        }
      })
  }

  return (
    <Card id="payment-link">
      <CardHeader>
        <CardTitle>Payment link</CardTitle>
        <CardDescription>
          {awaiting
            ? 'The member pays this link, or the team records a payment. The page checks again every 15 seconds.'
            : 'Links issued for this order.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {live ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={live.shortUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm break-all underline underline-offset-2"
              >
                {live.shortUrl}
              </a>
              {live.shortUrl && <CopyLink url={live.shortUrl} />}
            </div>
            <LinkFacts link={live} now={now} />
            <CancelNote link={live} />
          </div>
        ) : (
          awaiting && (
            <p className="text-sm">
              No payment link is live. Issue a new one, or record a payment received another way.
            </p>
          )
        )}

        {awaiting && (
          <div className="flex flex-wrap items-center gap-2">
            {canIssueLink(order) && (
              <Button
                variant={live ? 'outline' : 'default'}
                disabled={!mayIssue || issue.isPending}
                title={mayIssue ? undefined : `Needs ${CREATE_ORDER_PERMISSION}`}
                onClick={issueLink}
              >
                Issue new link
              </Button>
            )}
            {mayMarkPaid && canMarkPaid(order) && (
              <Button variant="outline" onClick={() => setPaying(true)}>
                Mark as paid
              </Button>
            )}
          </div>
        )}
        <RefusalText refusal={refusal} />

        {earlier.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">
              {live ? 'Earlier links' : 'Links'} ({earlier.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-4">
              {earlier.map((link) => (
                <li key={link.id} className="flex flex-col gap-2 rounded-md border p-3">
                  <span className="font-mono text-xs break-all">{link.shortUrl}</span>
                  <LinkFacts link={link} now={now} />
                  <CancelNote link={link} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
      {paying && <MarkPaidDialog order={order} onClose={() => setPaying(false)} onStale={onStale} />}
    </Card>
  )
}

export { OrderPaymentLinkCard }
