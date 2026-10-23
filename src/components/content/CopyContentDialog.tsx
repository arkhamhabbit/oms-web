import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { describeApiError } from '@/components/content/BlockFormDialog'
import { useCopyContentMutation } from '@/api/content'
import { useProductsQuery } from '@/api/products'
import { useKeyedState } from '@/lib/use-keyed-state'

export interface CopyContentDialogProps {
  productId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Copy-from-product (D4.20): the chosen product's blocks and product slides are added to this one. */
function CopyContentDialog({ productId, open, onOpenChange }: CopyContentDialogProps) {
  const [search, setSearch] = useKeyedState(open, () => '')
  const [error, setError] = useKeyedState<string | null>(open, () => null)
  const copy = useCopyContentMutation(productId)
  const products = useProductsQuery({ page: 0, size: 10, search })
  const candidates = (products.data?.content ?? []).filter((p) => p.id !== productId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy from product</DialogTitle>
          <DialogDescription>
            Adds a copy of the chosen product's blocks and slides to this product. Variant overrides
            are not copied.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search products by name"
          aria-label="Search products"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <ul className="flex max-h-64 flex-col divide-y overflow-y-auto rounded-md border">
          {candidates.length === 0 ? (
            <li className="p-3 text-sm text-muted-foreground">No products found.</li>
          ) : (
            candidates.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-sm">{product.name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={copy.isPending}
                  onClick={() =>
                    copy
                      .mutateAsync(product.id!)
                      .then(() => onOpenChange(false))
                      .catch((cause) => setError(describeApiError(cause)))
                  }
                >
                  Copy
                </Button>
              </li>
            ))
          )}
        </ul>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { CopyContentDialog }
