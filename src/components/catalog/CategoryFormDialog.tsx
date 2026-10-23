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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { MediaPicker, pickedFromRef, type PickedMedia } from '@/components/media/MediaPicker'
import { ApiClientError, applyApiErrorToForm } from '@/lib/api-error'
import { slugify } from '@/lib/slug'
import { flattenCategoryTree } from '@/lib/category-tree-adapter'
import {
  useCategoryTreeQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  type Category,
} from '@/api/categories'

const NONE = '__none__'

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z.string().trim().max(160).optional(),
  description: z.string().optional(),
  image: z.custom<PickedMedia | null>().nullable(),
  banner: z.custom<PickedMedia | null>().nullable(),
  parentId: z.string().optional(),
})
type CategoryFormValues = z.infer<typeof categoryFormSchema>

const emptyValues: CategoryFormValues = {
  name: '',
  slug: '',
  description: '',
  image: null,
  banner: null,
  parentId: NONE,
}

export interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omit to create a new category; supply the currently-loaded row to edit it. */
  category?: Category
  /** Pre-selects a parent when creating from "add subcategory" — ignored when editing. */
  defaultParentId?: string
}

function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  defaultParentId,
}: CategoryFormDialogProps) {
  const isEdit = !!category
  const treeQuery = useCategoryTreeQuery()
  const createCategory = useCreateCategoryMutation()
  const updateCategory = useUpdateCategoryMutation(category?.id ?? '')
  const pending = createCategory.isPending || updateCategory.isPending

  const slugEditedRef = React.useRef(isEdit)

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: emptyValues,
  })

  React.useEffect(() => {
    if (!open) {
      return
    }
    slugEditedRef.current = isEdit
    form.reset(
      category
        ? {
            name: category.name ?? '',
            slug: category.slug ?? '',
            description: category.description ?? '',
            image: pickedFromRef(category.image, category.imageMediaId),
            banner: pickedFromRef(category.banner, category.bannerMediaId),
            parentId: category.parentId ?? NONE,
          }
        : { ...emptyValues, parentId: defaultParentId ?? NONE }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category, defaultParentId])

  const parentOptions = flattenCategoryTree(treeQuery.data ?? [], category?.id)

  function onSubmit(values: CategoryFormValues) {
    const parentId = values.parentId === NONE ? undefined : values.parentId
    const payload = {
      name: values.name,
      slug: values.slug || undefined,
      description: values.description || undefined,
    }

    const mutation = isEdit
      ? updateCategory.mutateAsync({
          ...payload,
          // D4.21 — the media ids are echoed on every edit; null clears. A category still on a
          // legacy URL has no id to echo, so it sends null and the legacy URL stays as it was.
          imageMediaId: values.image?.id ?? null,
          bannerMediaId: values.banner?.id ?? null,
          // D2.11 — status/live are immutable through this endpoint but required in the
          // payload; sent back unchanged from what was loaded, never defaulted. Parent is
          // reparented through /move, not this form, so it isn't part of the edit payload.
          status: category!.status!,
          live: category!.live!,
          // D2.24 — version is required and compared before any field is applied.
          version: category!.version!,
        })
      : createCategory.mutateAsync({
          ...payload,
          parentId,
          imageMediaId: values.image?.id,
          bannerMediaId: values.banner?.id,
        })

    mutation
      .then(() => {
        toast.success(isEdit ? 'Category updated' : 'Category created')
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
          <DialogTitle>{isEdit ? 'Edit category' : 'New category'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {!isEdit && (
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No parent (root)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>No parent (root)</SelectItem>
                        {parentOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id} disabled={option.disabled}>
                            {'—'.repeat(option.depth)} {option.node.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image</FormLabel>
                  <FormControl>
                    <MediaPicker
                      label="image"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      legacyUrl={category?.legacyImageUrl}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="banner"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Banner</FormLabel>
                  <FormControl>
                    <MediaPicker
                      label="banner"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      legacyUrl={category?.legacyBannerUrl}
                    />
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

export { CategoryFormDialog }
