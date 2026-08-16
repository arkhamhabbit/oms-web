import * as React from 'react'
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ImageUrlField } from '@/components/form/ImageUrlField'
import { ApiClientError, applyApiErrorToForm } from '@/lib/api-error'
import { slugify } from '@/lib/slug'
import { useCreateBrandMutation, useUpdateBrandMutation, type Brand } from '@/api/brands'

const brandFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z.string().trim().max(160).optional(),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
})
type BrandFormValues = z.infer<typeof brandFormSchema>

const emptyValues: BrandFormValues = { name: '', slug: '', description: '', logoUrl: '', bannerUrl: '' }

export interface BrandFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omit to create a new brand; supply the currently-loaded row to edit it. */
  brand?: Brand
}

function BrandFormDialog({ open, onOpenChange, brand }: BrandFormDialogProps) {
  const isEdit = !!brand
  const createBrand = useCreateBrandMutation()
  const updateBrand = useUpdateBrandMutation(brand?.id ?? '')
  const pending = createBrand.isPending || updateBrand.isPending

  // Auto-follows the name into the slug until the operator edits the slug field directly —
  // register()'s onChange only fires on a real keystroke, not on form.setValue(), so this stays
  // accurate even though the slug field is also being written to programmatically below.
  const slugEditedRef = React.useRef(isEdit)

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: emptyValues,
  })

  React.useEffect(() => {
    if (!open) {
      return
    }
    slugEditedRef.current = isEdit
    form.reset(
      brand
        ? {
            name: brand.name ?? '',
            slug: brand.slug ?? '',
            description: brand.description ?? '',
            logoUrl: brand.logoUrl ?? '',
            bannerUrl: brand.bannerUrl ?? '',
          }
        : emptyValues
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, brand])

  function onSubmit(values: BrandFormValues) {
    const payload = {
      name: values.name,
      slug: values.slug || undefined,
      description: values.description || undefined,
      logoUrl: values.logoUrl || undefined,
      bannerUrl: values.bannerUrl || undefined,
    }

    const mutation = isEdit
      ? updateBrand.mutateAsync({
          ...payload,
          // D2.11 — status/live are immutable through this endpoint but required in the
          // payload; sent back unchanged from what was loaded, never defaulted.
          status: brand!.status!,
          live: brand!.live!,
        })
      : createBrand.mutateAsync(payload)

    mutation
      .then(() => {
        toast.success(isEdit ? 'Brand updated' : 'Brand created')
        onOpenChange(false)
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
          <DialogTitle>{isEdit ? 'Edit brand' : 'New brand'}</DialogTitle>
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
                          form.setValue('slug', slugify(event.target.value), { shouldValidate: true })
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL</FormLabel>
                  <FormControl>
                    <ImageUrlField {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bannerUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Banner URL</FormLabel>
                  <FormControl>
                    <ImageUrlField {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {isEdit ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export { BrandFormDialog }
