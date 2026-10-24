import { Badge } from '@/components/ui/badge'
import type { OrderStatus } from '@/api/orders'
import { ORDER_STATUS_LABEL } from '@/lib/orders'

const VARIANT: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING_PAYMENT: 'outline',
  CONFIRMED: 'secondary',
  PACKED: 'secondary',
  SHIPPED: 'secondary',
  OUT_FOR_DELIVERY: 'secondary',
  DELIVERED: 'default',
  PAYMENT_FAILED: 'destructive',
  EXPIRED: 'outline',
  CANCELLED: 'destructive',
  REFUNDED: 'destructive',
}

function OrderStatusBadge({ status }: { status: OrderStatus | undefined }) {
  return (
    <Badge variant={status ? VARIANT[status] : 'outline'}>
      {status ? ORDER_STATUS_LABEL[status] : 'Unknown'}
    </Badge>
  )
}

export { OrderStatusBadge }
