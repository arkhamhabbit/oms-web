import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SpecAttributeField } from '@/components/catalog/SpecAttributeField'
import { useAttributeGroupsQuery, useAttributesQuery, type Attribute } from '@/api/attributes'
import {
  useClearProductSpecMutation,
  useClearVariantSpecMutation,
  useProductSpecsQuery,
  useSetProductSpecMutation,
  useSetVariantSpecMutation,
  useVariantSpecsQuery,
  type Variant,
} from '@/api/products'

function groupAttributes(attributes: Attribute[], groups: { id?: string; name?: string }[]) {
  const groupsById = new Map(groups.map((g) => [g.id, g.name]))
  const byGroup = new Map<string, Attribute[]>()
  for (const attribute of attributes) {
    const key = attribute.groupId ?? '__ungrouped__'
    if (!byGroup.has(key)) {
      byGroup.set(key, [])
    }
    byGroup.get(key)!.push(attribute)
  }
  return [...byGroup.entries()].map(([groupId, attrs]) => ({
    groupId,
    groupName: groupsById.get(groupId) ?? 'Ungrouped',
    attributes: attrs,
  }))
}

function ProductLevelSpecs({ productId }: { productId: string }) {
  const attributesQuery = useAttributesQuery({ page: 0, size: 200, kind: 'SPEC' })
  const groupsQuery = useAttributeGroupsQuery()
  const specsQuery = useProductSpecsQuery(productId)
  const setSpec = useSetProductSpecMutation(productId)
  const clearSpec = useClearProductSpecMutation(productId)

  const productAttributes = (attributesQuery.data?.content ?? []).filter(
    (a) => a.appliesTo === 'PRODUCT'
  )
  const groups = groupAttributes(productAttributes, groupsQuery.data ?? [])
  const values = specsQuery.data ?? []

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No product-level SPEC attributes exist yet — add one on the Attributes screen.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.groupId}>
          <CardHeader>
            <CardTitle className="text-sm">{group.groupName}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {group.attributes.map((attribute) => (
              <SpecAttributeField
                key={attribute.id}
                attribute={attribute}
                values={values}
                mutations={{
                  set: (body) => setSpec.mutateAsync(body),
                  clear: (attributeId) => clearSpec.mutateAsync(attributeId),
                }}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function VariantLevelSpecs({ productId, variant }: { productId: string; variant: Variant }) {
  const attributesQuery = useAttributesQuery({ page: 0, size: 200, kind: 'SPEC' })
  const groupsQuery = useAttributeGroupsQuery()
  const specsQuery = useVariantSpecsQuery(productId, variant.id)
  const setSpec = useSetVariantSpecMutation(productId, variant.id!)
  const clearSpec = useClearVariantSpecMutation(productId, variant.id!)

  const variantAttributes = (attributesQuery.data?.content ?? []).filter(
    (a) => a.appliesTo === 'VARIANT' && a.kind === 'SPEC'
  )
  const groups = groupAttributes(variantAttributes, groupsQuery.data ?? [])
  const values = specsQuery.data ?? []

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No variant-level SPEC attributes exist yet — add one on the Attributes screen.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.groupId}>
          <CardHeader>
            <CardTitle className="text-sm">{group.groupName}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {group.attributes.map((attribute) => (
              <SpecAttributeField
                key={attribute.id}
                attribute={attribute}
                values={values}
                mutations={{
                  set: (body) => setSpec.mutateAsync(body),
                  clear: (attributeId) => clearSpec.mutateAsync(attributeId),
                }}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export interface ProductSpecsTabProps {
  productId: string
  variants: Variant[]
  isSimple: boolean
}

/**
 * Product-level and variant-level sub-tabs (spec §6). For a simple product there is exactly one
 * variant and no reason to make an operator pick it from a list, so the variant sub-tab renders
 * that one variant's specs directly without a variant picker — but it is still labelled as the
 * product's own specs vs. the single item's, matching §3's "never say variant" rule as closely as
 * a specs form can (an attribute here is inherently variant-scoped in the data model even when
 * there's only one).
 */
function ProductSpecsTab({ productId, variants, isSimple }: ProductSpecsTabProps) {
  const [level, setLevel] = React.useState<'product' | 'variant'>('product')
  const [variantId, setVariantId] = React.useState(variants[0]?.id)

  const selectedVariant = variants.find((v) => v.id === variantId) ?? variants[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={level === 'product' ? 'default' : 'outline'}
          onClick={() => setLevel('product')}
        >
          Product specs
        </Button>
        <Button
          size="sm"
          variant={level === 'variant' ? 'default' : 'outline'}
          onClick={() => setLevel('variant')}
        >
          {isSimple ? 'Item specs' : 'Variant specs'}
        </Button>
      </div>

      {level === 'product' && <ProductLevelSpecs productId={productId} />}

      {level === 'variant' &&
        (isSimple ? (
          selectedVariant && <VariantLevelSpecs productId={productId} variant={selectedVariant} />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <Button
                  key={v.id}
                  size="sm"
                  variant={v.id === selectedVariant?.id ? 'default' : 'outline'}
                  onClick={() => setVariantId(v.id)}
                >
                  {v.skuCode}
                </Button>
              ))}
            </div>
            {selectedVariant && <VariantLevelSpecs productId={productId} variant={selectedVariant} />}
          </div>
        ))}
    </div>
  )
}

export { ProductSpecsTab }
