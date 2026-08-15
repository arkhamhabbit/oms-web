import { Outlet } from 'react-router-dom'

function AuthLayout() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-6">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}

export default AuthLayout
