import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeftRightIcon, SlidersHorizontalIcon } from 'lucide-react'

import { ReconcileTab } from '@/components/inventory/ReconcileTab'
import { StockAdjustDialog, type StockFormSeed } from '@/components/inventory/StockAdjustDialog'
import { StockTransferDialog } from '@/components/inventory/StockTransferDialog'
import {
  ExpiringTab,
  LevelsTab,
  LowStockTab,
  MovementsTab,
  TotalsTab,
  type StockTabActions,
  type StockTabSeed,
} from '@/components/inventory/StockTabs'
import { TransferDrawer } from '@/components/inventory/TransferDrawer'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/auth/usePermissions'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'

type Tab = 'totals' | 'levels' | 'low' | 'expiring' | 'movements' | 'reconcile'

const TABS: { key: Tab; label: string }[] = [
  { key: 'totals', label: 'Totals' },
  { key: 'levels', label: 'Levels' },
  { key: 'low', label: 'Low stock' },
  { key: 'expiring', label: 'Expiring soon' },
  { key: 'movements', label: 'Movements' },
  { key: 'reconcile', label: 'Reconcile' },
]

function isTab(value: string | null): value is Tab {
  return TABS.some((t) => t.key === value)
}

function StockPage() {
  useBreadcrumb([{ label: 'Inventory' }, { label: 'Stock' }])
  const { has } = usePermissions()
  const [params, setParams] = useSearchParams()
  const tab: Tab = isTab(params.get('tab')) ? (params.get('tab') as Tab) : 'totals'

  // A link into a tab carries its filters in the URL; the tab reads them once when it mounts.
  const seed: StockTabSeed = {
    variantId: params.get('variant') ?? undefined,
    sku: params.get('sku') ?? undefined,
    warehouseId: params.get('warehouse') ?? undefined,
    batchId: params.get('batch') ?? undefined,
  }
  const seedKey = [seed.variantId, seed.warehouseId, seed.batchId].join('|')

  const [adjust, setAdjust] = React.useState<{ seed?: StockFormSeed } | undefined>()
  const [transfer, setTransfer] = React.useState<{ seed?: StockFormSeed } | undefined>()
  const [transferId, setTransferId] = React.useState<string | undefined>()
  const [lastTransferId, setLastTransferId] = React.useState<string | undefined>()

  const canAdjust = has('inventory.adjust')
  const canTransfer = has('inventory.transfer')
  const actions: StockTabActions = {
    canAdjust,
    canTransfer,
    onAdjust: (s) => setAdjust({ seed: s }),
    onTransfer: (s) => setTransfer({ seed: s }),
  }

  function selectTab(next: Tab) {
    setParams(next === 'totals' ? {} : { tab: next })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Stock</h1>
        <div className="flex gap-2">
          <Button
            disabled={!canAdjust}
            title={canAdjust ? undefined : 'Needs inventory.adjust'}
            onClick={() => actions.onAdjust()}
          >
            <SlidersHorizontalIcon /> Adjust stock
          </Button>
          <Button
            variant="outline"
            disabled={!canTransfer}
            title={canTransfer ? undefined : 'Needs inventory.transfer'}
            onClick={() => actions.onTransfer()}
          >
            <ArrowLeftRightIcon /> Transfer stock
          </Button>
        </div>
      </div>

      {lastTransferId && (
        <p role="status" className="text-sm">
          Transfer posted.{' '}
          <button type="button" className="underline" onClick={() => setTransferId(lastTransferId)}>
            See both halves
          </button>{' '}
          or{' '}
          <Link className="underline" to="/inventory/stock?tab=movements">
            open the ledger
          </Link>
          .
        </p>
      )}

      <div role="tablist" aria-label="Stock views" className="flex flex-wrap gap-1 border-b pb-2">
        {TABS.map((t) => (
          <Button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            size="sm"
            variant={tab === t.key ? 'default' : 'ghost'}
            onClick={() => selectTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.key === tab)?.label}>
        {tab === 'totals' && <TotalsTab actions={actions} />}
        {tab === 'levels' && <LevelsTab key={seedKey} actions={actions} seed={seed} />}
        {tab === 'low' && <LowStockTab />}
        {tab === 'expiring' && <ExpiringTab />}
        {tab === 'movements' && (
          <MovementsTab key={seedKey} seed={seed} onOpenTransfer={setTransferId} />
        )}
        {tab === 'reconcile' && <ReconcileTab canAdjust={canAdjust} />}
      </div>

      <StockAdjustDialog
        open={!!adjust}
        onOpenChange={(open) => !open && setAdjust(undefined)}
        seed={adjust?.seed}
      />
      <StockTransferDialog
        open={!!transfer}
        onOpenChange={(open) => !open && setTransfer(undefined)}
        seed={transfer?.seed}
        onDone={setLastTransferId}
      />
      <TransferDrawer referenceId={transferId} onClose={() => setTransferId(undefined)} />
    </div>
  )
}

export default StockPage
