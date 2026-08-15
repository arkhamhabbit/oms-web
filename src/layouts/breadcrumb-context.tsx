import * as React from 'react'

export interface BreadcrumbCrumb {
  label: string
  to?: string
}

interface BreadcrumbContextValue {
  crumbs: BreadcrumbCrumb[]
  setCrumbs: (crumbs: BreadcrumbCrumb[]) => void
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue | null>(null)

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, setCrumbs] = React.useState<BreadcrumbCrumb[]>([])
  const value = React.useMemo(() => ({ crumbs, setCrumbs }), [crumbs])
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>
}

export function useBreadcrumbContext() {
  const ctx = React.useContext(BreadcrumbContext)
  if (!ctx) {
    throw new Error('useBreadcrumbContext must be used within BreadcrumbProvider')
  }
  return ctx
}

/** Sets the breadcrumb trail for the current page. Call once at the top of a page component. */
export function useBreadcrumb(crumbs: BreadcrumbCrumb[]) {
  const { setCrumbs } = useBreadcrumbContext()
  const key = crumbs.map((c) => `${c.label}:${c.to ?? ''}`).join('|')

  React.useEffect(() => {
    setCrumbs(crumbs)
    return () => setCrumbs([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
