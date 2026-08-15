import { useBreadcrumb } from '@/layouts/breadcrumb-context'

function StubPage({ title }: { title: string }) {
  useBreadcrumb([{ label: title }])

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">Screen ships in a later task.</p>
    </div>
  )
}

export default StubPage
