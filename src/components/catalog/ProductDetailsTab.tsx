import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ProductCategoryPicker } from '@/components/catalog/ProductCategoryPicker'
import { ApiClientError, applyApiErrorToForm, toastApiError } from '@/lib/api-error'
import { slugify } from '@/lib/slug'
import { useKeyedState } from '@/lib/use-keyed-state'
import { useBrandsQuery } from '@/api/brands'
import { useCategoryTreeQuery } from '@/api/categories'
import {
  useSetCategoriesMutation,
  useUpdateProductMutation,
  type Product,
  type ProductCategory,
} from '@/api/products'

const detailsFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z.string().trim().max(160).optional(),
  brandId: z.string().min(1, 'Brand is required'),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
})
type DetailsFormValues = z.infer<typeof detailsFormSchema>

export interface ProductDetailsTabProps {
  product: Product
  categories: ProductCategory[]
  canWrite: boolean
}

function ProductDetailsTab({ product, categories, canWrite }: ProductDetailsTabProps) {
  const brandsQuery = useBrandsQuery({ page: 0, size: 200 })
  const treeQuery = useCategoryTreeQuery()
  const updateProduct = useUpdateProductMutation(product.id!)
  const setCategories = useSetCategoriesMutation(product.id!)

  const slugEditedRef = React.useRef(true)

  const form = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsFormSchema),
    defaultValues: {
      name: product.name ?? '',
      slug: product.slug ?? '',
      brandId: product.brandId ?? '',
      description: product.description ?? '',
      shortDescription: product.shortDescription ?? '',
    },
  })

  // Re-derives local picker state whenever the product identity changes (switching products) or
  // the server's own copy moves (a save just landed, or someone else changed it) — `version` is
  // the signal for the latter. See `useKeyedState`'s doc comment for why this runs during render.
  const resetKey = `${product.id}:${product.version}`
  const [selectedCategoryIds, setSelectedCategoryIds] = useKeyedState(resetKey, () =>
    categories.map((c) => c.categoryId!).filter(Boolean)
  )
  const [primaryCategoryId, setPrimaryCategoryId] = useKeyedState(
    resetKey,
    () => categories.find((c) => c.primary)?.categoryId
  )

  React.useEffect(() => {
    form.reset({
      name: product.name ?? '',
      slug: product.slug ?? '',
      brandId: product.brandId ?? '',
      description: product.description ?? '',
      shortDescription: product.shortDescription ?? '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, product.version])

  const categoriesDirty =
    JSON.stringify([...selectedCategoryIds].sort()) !==
      JSON.stringify(categories.map((c) => c.categoryId!).sort()) ||
    primaryCategoryId !== categories.find((c) => c.primary)?.categoryId

  function onSubmit(values: DetailsFormValues) {
    updateProduct
      .mutateAsync({
        name: values.name,
        slug: values.slug || undefined,
        brandId: values.brandId,
        description: values.description || undefined,
        shortDescription: values.shortDescription || undefined,
        // D2.11 — audience/listingVisibility/lockedDisplay are edited on the Visibility tab
        // through this same endpoint; echoed here unchanged. status/live are immutable through
        // this endpoint entirely (their own audited transitions) and must match what is stored.
        audience: product.audience,
        listingVisibility: product.listingVisibility,
        lockedDisplay: product.lockedDisplay,
        // D4.17(4): a TIER_RESTRICTED product must send its tier back on every edit, or 400.
        requiredTierCode: product.requiredTierCode ?? undefined,
        status: product.status!,
        live: product.live ?? false,
        version: product.version!,
      })
      .then(() => toast.success('Product details saved'))
      .catch((error) => {
        if (error instanceof ApiClientError) {
          applyApiErrorToForm(error, form)
        }
      })
  }

  function saveCategories() {
    setCategories
      .mutateAsync({
        categoryIds: selectedCategoryIds,
        primaryCategoryId: selectedCategoryIds.length > 0 ? primaryCategoryId : undefined,
        version: product.version!,
      })
      .then(() => toast.success('Categories saved'))
      .catch((error) => toastApiError(error))
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
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
                        disabled={!canWrite}
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
                        disabled={!canWrite}
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
                    <Select value={field.value} onValueChange={field.onChange} disabled={!canWrite}>
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
                name="shortDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short description</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!canWrite} />
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
                      <Input {...field} disabled={!canWrite} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Button type="submit" disabled={!canWrite || updateProduct.isPending}>
                  Save details
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Pick every category this product belongs to, then mark exactly one as primary — the
            server requires one when the product goes live, but this picker enforces it up front.
          </p>
          <ProductCategoryPicker
            tree={treeQuery.data ?? []}
            selectedIds={selectedCategoryIds}
            primaryId={primaryCategoryId}
            onChange={(ids, primary) => {
              setSelectedCategoryIds(ids)
              setPrimaryCategoryId(primary)
            }}
            disabled={!canWrite}
          />
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={!canWrite || !categoriesDirty || setCategories.isPending}
              onClick={saveCategories}
            >
              Save categories
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { ProductDetailsTab }
