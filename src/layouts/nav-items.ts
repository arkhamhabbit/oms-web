import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Tags,
  FolderTree,
  ListTree,
  Package,
  Users,
  ShieldCheck,
  ScrollText,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Permission key required to see this item — see `team/Permission.java`. Omit for always-visible items. */
  permission?: string
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Brands', to: '/brands', icon: Tags, permission: 'catalog.brand.read' },
  { label: 'Categories', to: '/categories', icon: FolderTree, permission: 'catalog.category.read' },
  { label: 'Attributes', to: '/attributes', icon: ListTree, permission: 'catalog.attribute.read' },
  { label: 'Products', to: '/products', icon: Package, permission: 'catalog.product.read' },
  { label: 'Team', to: '/team', icon: Users, permission: 'team.read' },
  { label: 'Roles', to: '/roles', icon: ShieldCheck, permission: 'team.read' },
  { label: 'Audit', to: '/audit', icon: ScrollText, permission: 'audit.read' },
]
