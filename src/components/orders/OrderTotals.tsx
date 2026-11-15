import { useState } from 'react'

import type { OrderDetail } from '@/api/orders'
import { TierBadge } from '@/components/membership/TierBadge'
import { refundedMinor, rupees } from '@/lib/orders'
import { cn } from '@/lib/utils'

function Row({
  label,
  value,
  strong,
  danger,
}: {
  label: React.ReactNode
  value: React.ReactNode
  strong?: boolean
  danger?: boolean
}) {
  return (
    <div
      className={cn(
        'flex justify-between gap-8 text-sm',
        strong && 'font-semibold',
        danger && 'text-destructive'
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

/** The totals ladder, right-aligned under the items: what was bought, what was paid, what came back. */
function OrderTotals({ order }: { order: OrderDetail }) {
  const [gstOpen, setGstOpen] = useState(false)
  const refunded = order.refundState === 'REFUNDED' ? refundedMinor(order) : 0
  const gst = order.gstBreakdown ?? []
  return (
    <dl aria-label="Order totals" className="ml-auto flex w-full max-w-sm flex-col gap-1.5">
      <Row label="Items" value={rupees(order.itemTotalMinor)} />
      <Row
        label="Shipping"
        value={
          order.freeShipping ? (
            <span className="inline-flex items-center gap-1.5">
              Free &mdash; <TierBadge code={order.tierCode} /> benefit
            </span>
          ) : (
            rupees(order.shippingMinor)
          )
        }
      />
      <Row label="Carrots redeemed" value={`− ${rupees(order.carrotsRedeemedMinor)}`} />
      <Row label="Bits spent" value={`${(order.bitsSpent ?? 0).toLocaleString('en-IN')} Bits`} />
      <div className="border-t pt-1.5">
        <Row label="Amount paid" value={rupees(order.payableMinor)} strong />
      </div>
      <Row
        label={
          gst.length > 0 ? (
            <button
              type="button"
              aria-expanded={gstOpen}
              onClick={() => setGstOpen((v) => !v)}
              className="text-left underline decoration-dotted underline-offset-2"
            >
              GST included
            </button>
          ) : (
            'GST included'
          )
        }
        value={rupees(order.gstMinor)}
      />
      {gstOpen && (
        <ul className="text-xs text-muted-foreground">
          {gst.map((g) => (
            <li key={g.rate}>
              {g.rate}%: taxable {rupees(g.taxableMinor)}, tax {rupees(g.taxMinor)}
            </li>
          ))}
        </ul>
      )}
      {refunded > 0 && (
        <>
          <Row label="Refunded" value={`− ${rupees(refunded)}`} danger />
          <div className="border-t pt-1.5">
            <Row label="Net" value={rupees((order.payableMinor ?? 0) - refunded)} strong />
          </div>
        </>
      )}
    </dl>
  )
}

export { OrderTotals }
