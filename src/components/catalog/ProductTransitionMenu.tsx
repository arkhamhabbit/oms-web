import * as React from 'react'
import { ChevronDownIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { toastApiError } from '@/lib/api-error'
import {
  availableProductTransitions,
  type ProductStatus,
  type ProductTransitionAction,
} from '@/lib/product-transitions'
import {
  useApproveProductMutation,
  useArchiveProductMutation,
  usePublishProductMutation,
  useRejectProductMutation,
  useSubmitProductMutation,
  useUnpublishProductMutation,
  type Product,
} from '@/api/products'

const PRODUCT_TRANSITION_DONE: Record<ProductTransitionAction, string> = {
  submit: 'submitted for review',
  approve: 'approved',
  reject: 'sent back to draft',
  publish: 'published',
  unpublish: 'unpublished',
  archive: 'archived',
}

export interface ProductTransitionMenuProps {
  product: Product
  canWrite: boolean
  canApprove: boolean
  canPublish: boolean
}

/**
 * D4.16's six product transitions (two more than brand/category — `submit`/`approve`/`reject`
 * cover `DRAFT <-> IN_REVIEW <-> ACTIVE`). Only the actions valid from the current status/live are
 * rendered (D2.17 — convenience, never security; the server re-checks regardless). Every refusal —
 * the approval guard naming a variant and field, the publish guard naming the brand or category —
 * comes back as `BUSINESS_RULE_VIOLATION`'s `message`, already a full sentence per the OMS error
 * catalog (D2.25), and is rendered as-is via `toastApiError`, same as brand/category transitions.
 */
function ProductTransitionMenu({
  product,
  canWrite,
  canApprove,
  canPublish,
}: ProductTransitionMenuProps) {
  const [pending, setPending] = React.useState(false)
  const [confirmArchive, setConfirmArchive] = React.useState(false)
  const submit = useSubmitProductMutation(product.id!)
  const approve = useApproveProductMutation(product.id!)
  const reject = useRejectProductMutation(product.id!)
  const publish = usePublishProductMutation(product.id!)
  const unpublish = useUnpublishProductMutation(product.id!)
  const archive = useArchiveProductMutation(product.id!)

  const transitions = availableProductTransitions(
    product.status as ProductStatus,
    !!product.live
  )

  if (transitions.length === 0) {
    return null
  }

  const permissionGranted: Record<ProductTransitionAction, boolean> = {
    submit: canWrite,
    approve: canApprove,
    reject: canApprove,
    publish: canPublish,
    unpublish: canPublish,
    archive: canPublish,
  }

  async function run(action: ProductTransitionAction) {
    const mutation = { submit, approve, reject, publish, unpublish, archive }[action]
    setPending(true)
    try {
      await mutation.mutateAsync()
      toast.success(`${product.name ?? 'Product'} ${PRODUCT_TRANSITION_DONE[action]}`)
    } catch (error) {
      toastApiError(error)
    } finally {
      setPending(false)
      setConfirmArchive(false)
    }
  }

  // Archive is one-way, so it names what it does and waits for a confirm.
  function handleSelect(action: ProductTransitionAction) {
    if (action === 'archive') {
      setConfirmArchive(true)
      return
    }
    void run(action)
  }

  const anyAllowed = transitions.some((t) => permissionGranted[t.action])

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!anyAllowed || pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Actions
          <ChevronDownIcon className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {transitions.map(({ action, label }) => (
          <DropdownMenuItem
            key={action}
            disabled={!permissionGranted[action]}
            onSelect={() => handleSelect(action)}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmDialog
      open={confirmArchive}
      onOpenChange={setConfirmArchive}
      title="Archive this product"
      confirmLabel="Archive"
      destructive
      pending={pending}
      onConfirm={() => void run('archive')}
    >
      <p>
        {product.name}: archiving cannot be undone. An archived product comes off sale and cannot
        be brought back.
      </p>
    </ConfirmDialog>
    </>
  )
}

export { ProductTransitionMenu }
