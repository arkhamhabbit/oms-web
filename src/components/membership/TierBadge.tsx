import { useEffectiveLadderQuery, type Tier } from '@/api/membership'
import { usePermissions } from '@/auth/usePermissions'
import { isTierColour, readableTextOn } from '@/lib/tier-colour'
import { cn } from '@/lib/utils'

/** A coloured chip in a tier's colour, for a table row or a version's ladder. */
function TierSwatch({ colourHex, className }: { colourHex?: string; className?: string }) {
  return (
    <span
      data-slot="tier-swatch"
      aria-hidden="true"
      className={cn('inline-block size-4 shrink-0 rounded-full border', className)}
      style={isTierColour(colourHex) ? { backgroundColor: colourHex } : undefined}
    />
  )
}

/** A tier's badge image, small enough to sit inside a chip or a table cell. */
function TierBadgeImage({ tier, className }: { tier: Tier; className?: string }) {
  const src = tier.badge?.thumbUrl ?? tier.badge?.url
  return src ? (
    <img src={src} alt="" className={cn('size-4 shrink-0 rounded-sm object-cover', className)} />
  ) : null
}

/**
 * A tier wherever the console shows one (D7.18): coloured from the **effective ladder** by the
 * tier's stable code, with the badge image when it has one and the tier's name as text. The
 * ladder is read once and cached; a code the ladder no longer has (a version withdrawn since)
 * is the neutral badge with the code as text — the console keeps no colour map of its own.
 */
function TierBadge({
  code,
  name,
  className,
}: {
  code: string | undefined
  /** Shown when the ladder has no such tier (a name the record itself carries). */
  name?: string
  className?: string
}) {
  const { has } = usePermissions()
  const ladder = useEffectiveLadderQuery(has('membership.read'))
  if (!code) {
    return null
  }
  const tier = ladder.data?.find((t) => t.code === code)
  const base =
    'inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap'

  if (!tier || !isTierColour(tier.colourHex)) {
    return (
      <span
        data-slot="tier-badge"
        data-tier={code}
        className={cn(base, 'bg-muted text-muted-foreground', className)}
      >
        {name ?? code}
      </span>
    )
  }
  return (
    <span
      data-slot="tier-badge"
      data-tier={code}
      className={cn(base, 'border-transparent', className)}
      style={{ backgroundColor: tier.colourHex, color: readableTextOn(tier.colourHex) }}
    >
      <TierBadgeImage tier={tier} />
      {tier.name ?? name ?? code}
    </span>
  )
}

export { TierBadge, TierBadgeImage, TierSwatch }
