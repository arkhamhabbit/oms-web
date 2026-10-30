import { Badge } from '@/components/ui/badge'

/** Active / Inactive for warehouses and suppliers. */
function ActiveBadge({ active }: { active: boolean | undefined }) {
  return active === false ? (
    <Badge variant="secondary">Inactive</Badge>
  ) : (
    <Badge variant="outline">Active</Badge>
  )
}

export { ActiveBadge }
