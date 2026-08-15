import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { brandsFixture } from '@/fixtures/brands'
import { productsFixture } from '@/fixtures/products'
import { categoryTreeFixture } from '@/fixtures/categories'

function countCategories(nodes: typeof categoryTreeFixture): number {
  return nodes.reduce((sum, node) => sum + 1 + countCategories(node.children), 0)
}

function DashboardPage() {
  useBreadcrumb([{ label: 'Dashboard' }])

  const stats = [
    { label: 'Brands', value: brandsFixture.length },
    { label: 'Categories', value: countCategories(categoryTreeFixture) },
    { label: 'Products', value: productsFixture.length },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader>
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className="text-3xl">{stat.value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

export default DashboardPage
