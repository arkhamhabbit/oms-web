import * as React from 'react'
import { LockIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserStatusBadge } from '@/components/users/UserStatusBadge'
import { usePermissions } from '@/auth/usePermissions'
import { useEffectiveLadderQuery } from '@/api/membership'
import {
  useUserVisibilityPreviewQuery,
  useVisibilityPreviewQuery,
  type VariantVisibility,
  type VisibilityPreview,
} from '@/api/products'
import { useUsersQuery, type User } from '@/api/users'

type Verdict = NonNullable<VisibilityPreview['visibility']>

const VERDICT_LABEL: Record<Verdict, string> = {
  VISIBLE: 'Visible',
  LOCKED: 'Locked',
  HIDDEN: 'Hidden',
}

const REASON_LABEL: Record<NonNullable<VisibilityPreview['reason']>, string> = {
  NOT_LIVE: 'The product is not live.',
  BRAND_NOT_LIVE: 'The brand is not live.',
  PUBLIC: 'Open to everyone.',
  TIER_MET: 'The viewer’s tier meets the requirement.',
  TIER_NOT_MET: 'The viewer’s tier is below the requirement.',
  TIER_NOT_IN_LADDER: 'The required tier is not in the ladder in effect.',
  ON_ALLOWLIST: 'The viewer is on the allowlist.',
  NOT_ON_ALLOWLIST: 'The viewer is not on the allowlist.',
}

const NO_TIER = '__no_tier__'

function VerdictBadge({ verdict }: { verdict: Verdict | undefined }) {
  if (!verdict) {
    return null
  }
  return (
    <Badge variant={verdict === 'VISIBLE' ? 'default' : verdict === 'LOCKED' ? 'secondary' : 'outline'}>
      {verdict === 'LOCKED' && <LockIcon className="mr-1 size-3" />}
      {VERDICT_LABEL[verdict]}
    </Badge>
  )
}

function VariantRow({ variant }: { variant: VariantVisibility }) {
  const discontinued = variant.variantStatus === 'DISCONTINUED'
  return (
    <tr className={discontinued ? 'text-muted-foreground' : undefined}>
      <td className="py-2 pr-3">
        <span className="font-mono text-xs">{variant.skuCode}</span>
        {variant.name && <span className="ml-2">{variant.name}</span>}
        {discontinued && (
          <Badge variant="outline" className="ml-2">
            Discontinued
          </Badge>
        )}
      </td>
      <td className="py-2 pr-3">
        <VerdictBadge verdict={variant.visibility} />
      </td>
      <td className="py-2 pr-3 text-sm">
        {variant.reason ? REASON_LABEL[variant.reason] : '—'}
      </td>
      <td className="py-2 text-sm">
        {variant.requiredTierCode ?? '—'}
        {variant.ownRequiredTierCode && (
          <span className="ml-1 text-xs text-muted-foreground">(its own)</span>
        )}
      </td>
    </tr>
  )
}

function PreviewResult({ preview }: { preview: VisibilityPreview }) {
  const variants = preview.variants ?? []
  return (
    <div className="flex flex-col gap-3" data-testid="visibility-preview-result">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Product</span>
        <VerdictBadge verdict={preview.visibility} />
        <span className="text-muted-foreground">
          {preview.reason ? REASON_LABEL[preview.reason] : ''}
          {preview.requiredTierCode ? ` Requires ${preview.requiredTierCode}.` : ''}
        </span>
      </div>
      {variants.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="pb-1 pr-3 font-medium">{variants.length === 1 ? 'SKU' : 'Variant'}</th>
              <th className="pb-1 pr-3 font-medium">Verdict</th>
              <th className="pb-1 pr-3 font-medium">Reason</th>
              <th className="pb-1 font-medium">Required tier</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {variants.map((variant) => (
              <VariantRow key={variant.variantId} variant={variant} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function TierPreview({ productId, enabledLadder }: { productId: string; enabledLadder: boolean }) {
  const ladder = useEffectiveLadderQuery(enabledLadder)
  const [tier, setTier] = React.useState<string>(NO_TIER)
  const preview = useVisibilityPreviewQuery(productId, tier === NO_TIER ? undefined : tier)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="preview-tier">Viewer’s tier</Label>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger id="preview-tier" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TIER}>No tier</SelectItem>
            {(ladder.data ?? []).map((t) => (
              <SelectItem key={t.code} value={t.code!}>
                {t.name} ({t.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <PreviewState query={preview} />
    </div>
  )
}

function PreviewState({
  query,
}: {
  query: { isLoading: boolean; error: unknown; data?: VisibilityPreview }
}) {
  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading preview…</p>
  }
  if (query.error) {
    return (
      <p className="text-sm text-destructive">
        {query.error instanceof Error ? query.error.message : 'The preview could not be loaded.'}
      </p>
    )
  }
  return query.data ? <PreviewResult preview={query.data} /> : null
}

function CustomerPreview({ productId }: { productId: string }) {
  const { has } = usePermissions()
  const [search, setSearch] = React.useState('')
  const [picked, setPicked] = React.useState<User | undefined>()
  const canSearch = has('identity.user.read')
  const users = useUsersQuery({ page: 0, size: 6, search: search.trim() })
  const preview = useUserVisibilityPreviewQuery(productId, picked?.id)

  if (!canSearch) {
    return (
      <p className="text-sm text-muted-foreground">
        Previewing a customer needs the <code>identity.user.read</code> permission to find them.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="preview-customer">Customer</Label>
        <Input
          id="preview-customer"
          placeholder="Find a customer by mobile, email or name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-80"
        />
        {picked && (
          <p className="text-sm">
            Previewing <span className="font-mono">{picked.mobile}</span> {picked.name}
          </p>
        )}
      </div>
      {search.trim().length >= 2 && (
        <ul className="flex max-w-xl flex-col divide-y rounded-md border">
          {(users.data?.content ?? []).map((user) => (
            <li key={user.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="font-mono">{user.mobile}</span>
              <span className="flex-1 truncate">{user.name}</span>
              <UserStatusBadge status={user.status} />
              <Button size="sm" variant="outline" onClick={() => setPicked(user)}>
                Preview
              </Button>
            </li>
          ))}
          {!users.isLoading && (users.data?.content ?? []).length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No customer matches “{search.trim()}”.
            </li>
          )}
        </ul>
      )}
      {picked && <PreviewState query={preview} />}
    </div>
  )
}

/**
 * D4.18: what a viewer sees for the product *and each variant* — a stricter size can be LOCKED
 * under a VISIBLE product. Previewed either at a chosen tier (taken as given) or as a real
 * customer (tier resolved by membership, then the allowlist). The server runs the rule; this only
 * renders its verdicts.
 */
function ProductVisibilityPreviewCard({ productId }: { productId: string }) {
  const { has } = usePermissions()
  const [mode, setMode] = React.useState<'tier' | 'customer'>('tier')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>
          What a viewer sees for this product and each of its variants. A variant can be locked
          while the product is visible; it is shown locked only when the product’s locked display
          is “Show, locked”.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'tier' ? 'default' : 'outline'}
            onClick={() => setMode('tier')}
          >
            At a tier
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'customer' ? 'default' : 'outline'}
            onClick={() => setMode('customer')}
          >
            As a customer
          </Button>
        </div>
        {mode === 'tier' ? (
          <TierPreview productId={productId} enabledLadder={has('membership.read')} />
        ) : (
          <CustomerPreview productId={productId} />
        )}
      </CardContent>
    </Card>
  )
}

export { ProductVisibilityPreviewCard }
