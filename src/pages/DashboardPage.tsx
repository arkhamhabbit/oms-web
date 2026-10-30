import { Link } from 'react-router-dom'

import { useDashboardCount } from '@/api/dashboard'
import { usePermissions } from '@/auth/usePermissions'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { visibleDashboardCards, type DashboardCard } from '@/lib/dashboard'

function CountCard({ card }: { card: DashboardCard }) {
  const count = useDashboardCount(card.key)

  return (
    <Card data-testid={`dashboard-card-${card.key}`}>
      <CardHeader>
        <CardDescription>
          <Link to={card.to} className="hover:text-foreground hover:underline">
            {card.label}
          </Link>
        </CardDescription>
        {count.isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
            Could not load
            <Button variant="outline" size="sm" onClick={() => count.refetch()}>
              Retry
            </Button>
          </div>
        ) : count.isPending ? (
          <div
            className="h-9 w-16 animate-pulse rounded-md bg-muted"
            role="status"
            aria-label={`Loading ${card.label}`}
          />
        ) : (
          <CardTitle className="text-3xl">{count.data.toLocaleString('en-IN')}</CardTitle>
        )}
        <p className="text-xs text-muted-foreground">{card.hint}</p>
      </CardHeader>
    </Card>
  )
}

function DashboardPage() {
  useBreadcrumb([{ label: 'Dashboard' }])
  const { has } = usePermissions()
  const cards = visibleDashboardCards(has)

  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing to count here yet: this account has no read access to the lists the dashboard
        summarises. Use the navigation for what it can open.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <CountCard key={card.key} card={card} />
      ))}
    </div>
  )
}

export default DashboardPage
