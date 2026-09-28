import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ApiClientError, applyApiErrorToForm } from '@/lib/api-error'
import { slugify } from '@/lib/slug'
import { useBrandsQuery } from '@/api/brands'
import { useCreateProductMutation } from '@/api/products'

const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z.string().trim().max(160).optional(),
  brandId: z.string().min(1, 'Brand is required'),
  skuCode: z.string().trim().max(64).optional(),
})
type ProductFormValues = z.infer<typeof productFormSchema>

const emptyValues: ProductFormValues = { name: '', slug: '', brandId: '', skuCode: '' }

export interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Create-only. A product's other fields (categories, descriptions, pricing/codes, options,
 * specs, images, visibility) are edited on its detail page once it exists — creating one is
 * deliberately the smallest form that gets an operator to that page. **The word "variant" never
 * appears here**: `skuCode`, if given, becomes the auto-created default variant's SKU (D4.9), but
 * this form only ever talks about "the product."
 */
function ProductFormDialog({ open, onOpenChange }: ProductFormDialogProps) {
  const navigate = useNavigate()
  const brandsQuery = useBrandsQuery({ page: 0, size: 200, status: 'ACTIVE' })
  const createProduct = useCreateProductMutation()

  const slugEditedRef = React.useRef(false)

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: emptyValues,
  })

  React.useEffect(() => {
    if (!open) {
      return
    }
    slugEditedRef.current = false
    form.reset(emptyValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function onSubmit(values: ProductFormValues) {
    createProduct
      .mutateAsync({
        name: values.name,
        slug: values.slug || undefined,
        brandId: values.brandId,
        skuCode: values.skuCode || undefined,
      })
      .then((product) => {
        toast.success('Product created')
        onOpenChange(false)
        navigate(`/products/${product.id}`)
      })
      .catch((error) => {
        if (error instanceof ApiClientError) {
          applyApiErrorToForm(error, form)
        }
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        field.onChange(event)
                        if (!slugEditedRef.current) {
                          form.setValue('slug', slugify(event.target.value), {
                            shouldValidate: true,
                          })
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        slugEditedRef.current = true
                        field.onChange(event)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brandId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a brand" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(brandsQuery.data?.content ?? []).map((brand) => (
                        <SelectItem key={brand.id} value={brand.id!}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="skuCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU code (optional — derived from slug if left blank)</FormLabel>
                  <FormControl>
                    <Input {...field} className="font-mono" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createProduct.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export { ProductFormDialog }
