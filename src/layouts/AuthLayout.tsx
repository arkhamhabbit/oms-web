import { Outlet } from 'react-router-dom'

import lockup from '@/assets/brand/habbit-lockup.svg'

function AuthLayout() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <img src={lockup} alt="Habbit" className="h-28 w-auto" />
        <div className="w-full">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
