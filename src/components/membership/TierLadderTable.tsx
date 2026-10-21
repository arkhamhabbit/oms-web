import type { Tier } from '@/api/membership'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { minorToMajorString } from '@/lib/money'

const points = (value: number | undefined) => (value ?? 0).toLocaleString('en-IN')

/**
 * A version's ladder, lowest tier first. Reach is the points that promote a member at once;
 * maintain is the (lower) bar that keeps the tier at a cycle's end (D7.15). Carrots are stored in
 * paise and shown in rupees (D3.2).
 */
function TierLadderTable({ tiers }: { tiers: Tier[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead className="text-right">Reach (Bits in a cycle)</TableHead>
          <TableHead className="text-right">Maintain threshold (Bits in a cycle)</TableHead>
          <TableHead className="text-right">Carrots per friend order</TableHead>
          <TableHead>Pricing</TableHead>
          <TableHead>Free shipping</TableHead>
          <TableHead className="text-right">Active invites</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tiers.map((tier) => (
          <TableRow key={tier.id ?? tier.code}>
            <TableCell>{tier.rank}</TableCell>
            <TableCell>
              <span className="font-medium">{tier.name}</span>{' '}
              <span className="font-mono text-xs text-muted-foreground">{tier.code}</span>
            </TableCell>
            <TableCell className="text-right">{points(tier.thresholdPoints12mo)}</TableCell>
            <TableCell className="text-right">{points(tier.maintainThresholdPoints)}</TableCell>
            <TableCell className="text-right">
              ₹{minorToMajorString(tier.carrotsPerFriendOrderMinor ?? 0)}
            </TableCell>
            <TableCell>{tier.pricingLevel === 'LOWEST' ? 'Lowest' : 'Member'}</TableCell>
            <TableCell>{tier.freeShipping ? 'Yes' : 'No'}</TableCell>
            <TableCell className="text-right">{tier.activeInviteLimit}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export { TierLadderTable }
