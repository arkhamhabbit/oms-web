import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { ChevronRight, LogOut } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { navItems } from '@/layouts/nav-items'
import { BreadcrumbProvider, useBreadcrumbContext } from '@/layouts/breadcrumb-context'
import { useLogoutMutation, useProfileQuery } from '@/api/auth'
import { usePermissions } from '@/auth/usePermissions'

function Sidebar() {
  // By the time AppShell renders, RequireAuth has already resolved the profile query this
  // reads from (same query key, shared cache) — never pending here, so no flash of items the
  // member doesn't have while permissions "load".
  const { has } = usePermissions()
  const visibleItems = navItems.filter((item) => !item.permission || has(item.permission))

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold tracking-tight">OMS Admin</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function Breadcrumbs() {
  const { crumbs } = useBreadcrumbContext()

  if (crumbs.length === 0) {
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="size-3.5" />}
            {crumb.to && !isLast ? (
              <Link to={crumb.to} className="hover:text-foreground">
                {crumb.label}
              </Link>
            ) : (
              <span className={cn(isLast && 'font-medium text-foreground')}>{crumb.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

function Header() {
  const navigate = useNavigate()
  const profile = useProfileQuery()
  const logout = useLogoutMutation()

  function handleLogout() {
    // Cache-clear happens in the mutation's onSettled regardless of outcome (see
    // useLogoutMutation) — a shared machine must not keep this member's data around even if
    // the network call itself failed.
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-4">
      <Breadcrumbs />
      <div className="flex items-center gap-3">
        <Link
          to="/profile"
          data-slot="current-member"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {profile.data?.name ?? profile.data?.email}
        </Link>
        <Separator orientation="vertical" className="h-6" />
        <Button variant="ghost" size="sm" onClick={handleLogout} disabled={logout.isPending}>
          <LogOut className="size-4" />
          Log out
        </Button>
      </div>
    </header>
  )
}

function AppShell() {
  return (
    <BreadcrumbProvider>
      <div className="flex h-svh w-full overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  )
}

export default AppShell
