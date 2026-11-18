import { Badge } from '@/components/ui/badge'
import { SHIPMENT_STATE_LABEL, SHIPMENT_STATUS_LABEL, type ShipmentState } from '@/lib/shipping'
import type { ShipmentStatus } from '@/api/shipping'

const TROUBLE = new Set(['BOOKING_FAILED', 'PROBLEM', 'DELIVERY_FAILED', 'LOST', 'DAMAGED'])
const DONE = new Set(['DELIVERED'])
const QUIET = new Set(['NONE', 'CANCELLED'])

function variantFor(code: string) {
  if (TROUBLE.has(code)) return 'destructive' as const
  if (DONE.has(code)) return 'default' as const
  if (QUIET.has(code)) return 'outline' as const
  return 'secondary' as const
}

/** The order's shipping state (list and panel). */
function ShipmentStateChip({ state }: { state: ShipmentState | undefined }) {
  const code = state ?? 'NONE'
  return <Badge variant={variantFor(code)}>{SHIPMENT_STATE_LABEL[code]}</Badge>
}

/** One shipment's own status (history tables). */
function ShipmentStatusChip({ status }: { status: ShipmentStatus | undefined }) {
  if (!status) return null
  return <Badge variant={variantFor(status)}>{SHIPMENT_STATUS_LABEL[status]}</Badge>
}

export { ShipmentStateChip, ShipmentStatusChip }
