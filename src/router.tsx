import { createBrowserRouter } from 'react-router-dom'

import AppShell from '@/layouts/AppShell'
import AuthLayout from '@/layouts/AuthLayout'
import LoginPage from '@/pages/auth/LoginPage'
import AcceptInvitePage from '@/pages/auth/AcceptInvitePage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import ForcePasswordChangePage from '@/pages/auth/ForcePasswordChangePage'
import DashboardPage from '@/pages/DashboardPage'
import BrandsPage from '@/pages/BrandsPage'
import CategoriesPage from '@/pages/CategoriesPage'
import AttributesPage from '@/pages/AttributesPage'
import ProductsPage from '@/pages/ProductsPage'
import TeamPage from '@/pages/TeamPage'
import RolesPage from '@/pages/RolesPage'
import AuditPage from '@/pages/AuditPage'
import ProfilePage from '@/pages/ProfilePage'
import RequireAuth from '@/auth/RequireAuth'
import RequirePermission from '@/auth/RequirePermission'
import { onUnauthorized } from '@/api/client'

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/accept-invite', element: <AcceptInvitePage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      // Authenticated (the member just logged in with a temporary password), but not yet
      // allowed into the shell — deliberately outside RequireAuth's element below, which
      // would otherwise redirect a mustChangePassword session straight back here forever.
      { path: '/force-password-change', element: <ForcePasswordChangePage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <DashboardPage /> },
          {
            path: '/brands',
            element: (
              <RequirePermission permission="catalog.brand.read">
                <BrandsPage />
              </RequirePermission>
            ),
          },
          {
            path: '/categories',
            element: (
              <RequirePermission permission="catalog.category.read">
                <CategoriesPage />
              </RequirePermission>
            ),
          },
          {
            path: '/attributes',
            element: (
              <RequirePermission permission="catalog.attribute.read">
                <AttributesPage />
              </RequirePermission>
            ),
          },
          {
            path: '/products',
            element: (
              <RequirePermission permission="catalog.product.read">
                <ProductsPage />
              </RequirePermission>
            ),
          },
          {
            path: '/team',
            element: (
              <RequirePermission permission="team.read">
                <TeamPage />
              </RequirePermission>
            ),
          },
          {
            path: '/roles',
            element: (
              <RequirePermission permission="team.read">
                <RolesPage />
              </RequirePermission>
            ),
          },
          {
            path: '/audit',
            element: (
              <RequirePermission permission="audit.read">
                <AuditPage />
              </RequirePermission>
            ),
          },
          // No permission required beyond a live session — see ProfileResponse in the spec.
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
])

// A session that dies mid-app (revoked elsewhere, expired) surfaces as a 401 on whatever
// request happened to be in flight, not as a react-router navigation — this is what turns
// that into one. See the doc comment on `onUnauthorized` in api/client.ts for why the
// registration runs in this direction.
onUnauthorized(() => {
  if (router.state.location.pathname !== '/login') {
    router.navigate('/login')
  }
})
