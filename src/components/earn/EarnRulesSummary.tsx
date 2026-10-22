import type { EarnRules } from '@/api/earn'
import { minorToMajorString } from '@/lib/money'

const bits = (value: number | undefined) => `${(value ?? 0).toLocaleString('en-IN')} Bits`
const carrots = (value: number | undefined) => `₹${minorToMajorString(value ?? 0)}`

/** The eight parameters of a version, read-only. */
function EarnRulesSummary({ rules }: { rules: EarnRules }) {
  const rows: [string, string][] = [
    ['Welcome Bits', bits(rules.welcomePoints)],
    ['Welcome Carrots', carrots(rules.welcomeCarrotsMinor)],
    ['Referral join Bits', bits(rules.referralJoinPoints)],
    ['Referral first-order Carrots', carrots(rules.referralFirstOrderCarrotsMinor)],
    ['Profile complete Bits', bits(rules.profileCompletePoints)],
    ['Device connected Bits', bits(rules.deviceConnectedPoints)],
    ['First order Bits', bits(rules.firstOrderPoints)],
    ['Welcome bonus for legacy members', rules.welcomeForLegacy ? 'Yes' : 'No'],
  ]
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export { EarnRulesSummary }
