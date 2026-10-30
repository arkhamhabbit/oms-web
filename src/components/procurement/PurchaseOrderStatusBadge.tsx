import { Badge } from '@/components/ui/badge'
import type { PurchaseOrderStatus } from '@/api/procurement'
import { PO_STATUS_LABEL } from '@/lib/procurement'

function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus | undefined }) {
  if (!status) {
    return null
  }
  const variant =
    status === 'CANCELLED'
      ? 'destructive'
      : status === 'DRAFT'
        ? 'secondary'
        : status === 'RECEIVED'
          ? 'default'
          : 'outline'
  return <Badge variant={variant}>{PO_STATUS_LABEL[status]}</Badge>
}

export { PurchaseOrderStatusBadge }
