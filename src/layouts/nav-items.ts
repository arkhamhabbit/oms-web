import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Tags,
  FolderTree,
  ListTree,
  Package,
  Users,
  ShieldCheck,
  UserRound,
  ScrollText,
  IndianRupee,
  Send,
  Medal,
  Gift,
  Images,
  Tag,
  ShoppingBag,
  Warehouse,
  Boxes,
  Layers,
  Truck,
  ClipboardList,
  PackageCheck,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Permission key required to see this item — see `team/Permission.java`. Omit for always-visible items. */
  permission?: string
  /** Items sharing a group sit under one heading, shown only when the member can see at least one of them. */
  group?: string
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Brands', to: '/brands', icon: Tags, permission: 'catalog.brand.read' },
  { label: 'Categories', to: '/categories', icon: FolderTree, permission: 'catalog.category.read' },
  { label: 'Attributes', to: '/attributes', icon: ListTree, permission: 'catalog.attribute.read' },
  { label: 'Tags', to: '/tags', icon: Tag, permission: 'catalog.attribute.read' },
  { label: 'Media', to: '/media', icon: Images, permission: 'catalog.media.read' },
  { label: 'Products', to: '/products', icon: Package, permission: 'catalog.product.read' },
  { label: 'Pricing', to: '/pricing', icon: IndianRupee, permission: 'pricing.read' },
  { label: 'Membership', to: '/membership', icon: Medal, permission: 'membership.read' },
  { label: 'Earn rules', to: '/earn', icon: Gift, permission: 'earn.read' },
  { label: 'Orders', to: '/orders', icon: ShoppingBag, permission: 'orders.read' },
  {
    label: 'Warehouses',
    to: '/inventory/warehouses',
    icon: Warehouse,
    permission: 'warehouse.read',
    group: 'Inventory',
  },
  {
    label: 'Stock',
    to: '/inventory/stock',
    icon: Boxes,
    permission: 'inventory.read',
    group: 'Inventory',
  },
  {
    label: 'Batches',
    to: '/inventory/batches',
    icon: Layers,
    permission: 'inventory.read',
    group: 'Inventory',
  },
  {
    label: 'Suppliers',
    to: '/procurement/suppliers',
    icon: Truck,
    permission: 'procurement.supplier.read',
    group: 'Procurement',
  },
  {
    label: 'Purchase orders',
    to: '/procurement/purchase-orders',
    icon: ClipboardList,
    permission: 'procurement.po.read',
    group: 'Procurement',
  },
  {
    label: 'Goods receipts',
    to: '/procurement/goods-receipts',
    icon: PackageCheck,
    permission: 'procurement.grn.read',
    group: 'Procurement',
  },
  { label: 'Users', to: '/users', icon: UserRound, permission: 'identity.user.read' },
  { label: 'Invites', to: '/invites', icon: Send, permission: 'invite.read' },
  { label: 'Team', to: '/team', icon: Users, permission: 'team.read' },
  { label: 'Roles', to: '/roles', icon: ShieldCheck, permission: 'team.read' },
  { label: 'Audit', to: '/audit', icon: ScrollText, permission: 'audit.read' },
]
