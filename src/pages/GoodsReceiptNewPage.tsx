import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { BackLink, DetailError, ListError } from '@/components/common/PageParts'
import { GoodsReceiptForm } from '@/components/procurement/GoodsReceiptForm'
import { PurchaseOrderStatusBadge } from '@/components/procurement/PurchaseOrderStatusBadge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { useOpenPurchaseOrdersQuery, usePurchaseOrderQuery } from '@/api/procurement'
import { isReceivable } from '@/lib/procurement'

function GoodsReceiptNewPage() {
  useBreadcrumb([
    { label: 'Procurement' },
    { label: 'Goods receipts', to: '/procurement/goods-receipts' },
    { label: 'Post a receipt' },
  ])
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const poId = params.get('po') ?? ''

  // Approved and partially received orders only: that is exactly the /open view.
  const open = useOpenPurchaseOrdersQuery({ page: 0, size: 100 })
  const order = usePurchaseOrderQuery(poId || undefined)

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <BackLink to="/procurement/goods-receipts" label="Goods receipts" />
      <h1 className="text-xl font-semibold">Post a goods receipt</h1>

      <div className="grid gap-1.5">
        <label htmlFor="grn-po" className="text-sm font-medium">
          Purchase order
        </label>
        <Select value={poId} onValueChange={(next) => setParams({ po: next })}>
          <SelectTrigger id="grn-po" className="w-96" aria-label="Purchase order">
            <SelectValue placeholder={open.isLoading ? 'Loading…' : 'Choose an approved order'} />
          </SelectTrigger>
          <SelectContent>
            {(open.data?.content ?? []).map((po) => (
              <SelectItem key={po.id} value={po.id!}>
                {po.poNumber} — {po.supplierName} ({po.quantityOutstanding} outstanding)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {open.isError && <ListError error={open.error} what="Open purchase orders" />}
        {!open.isLoading && (open.data?.content ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            No order is approved and waiting for goods.
          </p>
        )}
      </div>

      {poId && order.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {poId && order.isError && (
        <DetailError
          error={order.error}
          noun="purchase order"
          back={{ to: '/procurement/goods-receipts', label: 'Goods receipts' }}
          permission="procurement.po.read"
        />
      )}
      {order.data && (
        <>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-mono font-medium">{order.data.poNumber}</span>
            <PurchaseOrderStatusBadge status={order.data.status} />
            <span className="text-muted-foreground">
              {order.data.supplierName} → {order.data.warehouseCode}
            </span>
          </div>
          {isReceivable(order.data.status) ? (
            <GoodsReceiptForm
              key={order.data.id}
              order={order.data}
              onPosted={(receipt) => {
                toast.success(`Receipt ${receipt.grnNumber} posted`)
                navigate(`/procurement/goods-receipts/${receipt.id}`)
              }}
            />
          ) : (
            <p role="alert" className="text-sm">
              {order.data.poNumber} is {order.data.status?.toLowerCase().replace('_', ' ')}: goods
              can be received only against an approved or partly received order.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default GoodsReceiptNewPage
