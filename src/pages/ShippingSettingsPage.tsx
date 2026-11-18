import * as React from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/data-table/DataTable'
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { useWarehousesQuery } from '@/api/inventory'
import {
  useCurrentShippingSettingsQuery,
  usePublishShippingSettingsMutation,
  useShippingProvidersQuery,
  useShippingSettingsVersionsQuery,
  useTestProviderMutation,
  type ProviderTest,
  type ShippingProvider,
  type ShippingSettings,
} from '@/api/shipping'
import { isApiError, type ApiFieldError } from '@/lib/api-error'
import { formatDateTime } from '@/lib/dates'
import {
  box,
  grams,
  listInWords,
  MISSING_CONTACT_LABEL,
  providerLabel,
  UNPROVEN_PROVIDERS,
} from '@/lib/shipping'

const PAGE_SIZE = 20
const SWITCH_NOTE =
  'Switching applies to new bookings. Shipments already booked stay with the provider that booked them.'

function ShippingSettingsPage() {
  useBreadcrumb([{ label: 'Orders', to: '/orders' }, { label: 'Shipping' }])
  const { has } = usePermissions()
  const canWrite = has('shipping.settings')
  const [pageIndex, setPageIndex] = React.useState(0)
  const current = useCurrentShippingSettingsQuery()
  const providers = useShippingProvidersQuery()
  const versions = useShippingSettingsVersionsQuery(pageIndex, PAGE_SIZE)
  const warehouses = useWarehousesQuery({ page: 0, size: 200 })
  const warehouseCode = (id: string | null | undefined) =>
    warehouses.data?.content?.find((w) => w.id === id)?.code ?? (id ? `${id.slice(0, 8)}…` : '—')

  const columns: ColumnDef<ShippingSettings, unknown>[] = [
    { id: 'effectiveFrom', header: 'Effective from', cell: ({ row }) => formatDateTime(row.original.effectiveFrom) },
    { id: 'provider', header: 'Default provider', cell: ({ row }) => providerLabel(row.original.defaultProviderCode) },
    {
      id: 'auto',
      header: 'Automatic booking',
      cell: ({ row }) =>
        row.original.autoBookEnabled ? `On, after ${row.original.autoBookDelayMinutes} min` : 'Off',
    },
    { id: 'warehouse', header: 'Pickup', cell: ({ row }) => warehouseCode(row.original.defaultPickupWarehouseId) },
    {
      id: 'fallback',
      header: 'Fallback package',
      cell: ({ row }) =>
        `${grams(row.original.fallbackWeightGrams)}, ${box(row.original.fallbackLengthMm, row.original.fallbackWidthMm, row.original.fallbackHeightMm)}`,
    },
    { id: 'notes', header: 'Notes', cell: ({ row }) => <span className="whitespace-normal">{row.original.notes ?? ''}</span> },
    {
      id: 'current',
      header: '',
      cell: ({ row }) =>
        row.original.versionId && row.original.versionId === current.data?.versionId ? 'In effect' : '',
    },
  ]

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Shipping</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Shipping settings are versions. A new version takes effect the moment it is published;
        earlier ones stay as the record. Provider credentials live in the server&apos;s
        configuration, never here.{' '}
        <Link to="/shipping/log" className="underline underline-offset-2">
          Shipping log
        </Link>
      </p>

      {(current.isError || providers.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(current.error)
            ? current.error.message
            : isApiError(providers.error)
              ? providers.error.message
              : 'The shipping settings could not be loaded.'}
        </p>
      )}

      {current.data && providers.data && (
        <SettingsForm
          key={current.data.versionId}
          current={current.data}
          providers={providers.data}
          canWrite={canWrite}
        />
      )}

      <h2 className="text-base font-semibold">Versions</h2>
      <DataTable
        columns={columns}
        data={versions.data?.content ?? []}
        isLoading={versions.isLoading}
        emptyMessage="No shipping settings versions."
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          pageCount: versions.data?.totalPages ?? 0,
          totalElements: versions.data?.totalElements ?? 0,
          onPageIndexChange: setPageIndex,
        }}
      />
    </div>
  )
}

const asInt = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null)

function rangeProblem(text: string, min: number, max: number, unit: string): string | undefined {
  const n = asInt(text)
  return n === null || n < min || n > max ? `A whole number of ${unit} from ${min} to ${max}.` : undefined
}

/** Why a provider cannot be picked as the default, or undefined when it can. */
export function providerBlocked(p: ShippingProvider): string | undefined {
  if (!p.configured) {
    return 'Not configured: its credentials are not set on the server, so it cannot be the default.'
  }
  return p.code ? UNPROVEN_PROVIDERS[p.code] : undefined
}

function SettingsForm({
  current,
  providers,
  canWrite,
}: {
  current: ShippingSettings
  providers: ShippingProvider[]
  canWrite: boolean
}) {
  const publish = usePublishShippingSettingsMutation()
  const [provider, setProvider] = React.useState(current.defaultProviderCode ?? 'MANUAL')
  const [autoOn, setAutoOn] = React.useState(!!current.autoBookEnabled)
  const [delay, setDelay] = React.useState(String(current.autoBookDelayMinutes ?? 30))
  const [warehouseId, setWarehouseId] = React.useState(current.defaultPickupWarehouseId ?? '')
  const [weight, setWeight] = React.useState(String(current.fallbackWeightGrams ?? ''))
  const [length, setLength] = React.useState(String(current.fallbackLengthMm ?? ''))
  const [width, setWidth] = React.useState(String(current.fallbackWidthMm ?? ''))
  const [height, setHeight] = React.useState(String(current.fallbackHeightMm ?? ''))
  const [notes, setNotes] = React.useState('')
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [refusal, setRefusal] = React.useState<string | undefined>()
  const [fieldErrors, setFieldErrors] = React.useState<ApiFieldError[]>([])

  const manual = provider === 'MANUAL'
  // Automatic booking never uses Manual: with Manual as the default it stays off.
  const autoEffective = autoOn && !manual
  const problems = {
    delay: autoEffective ? rangeProblem(delay, 5, 1440, 'minutes') : undefined,
    weight: rangeProblem(weight, 1, 100000, 'grams'),
    length: rangeProblem(length, 1, 5000, 'millimetres'),
    width: rangeProblem(width, 1, 5000, 'millimetres'),
    height: rangeProblem(height, 1, 5000, 'millimetres'),
  }
  const ready = Object.values(problems).every((p) => p === undefined)

  function submit() {
    setRefusal(undefined)
    setFieldErrors([])
    publish
      .mutateAsync({
        defaultProviderCode: provider,
        autoBookEnabled: autoEffective,
        autoBookDelayMinutes: asInt(delay) ?? current.autoBookDelayMinutes ?? 30,
        defaultPickupWarehouseId: warehouseId || undefined,
        fallbackWeightGrams: asInt(weight)!,
        fallbackLengthMm: asInt(length)!,
        fallbackWidthMm: asInt(width)!,
        fallbackHeightMm: asInt(height)!,
        notes: notes.trim() || undefined,
      })
      .then(() => {
        toast.success('Shipping settings published')
        setConfirmOpen(false)
      })
      .catch((error) => {
        setConfirmOpen(false)
        setRefusal(isApiError(error) ? error.message : 'The settings could not be published.')
        setFieldErrors(isApiError(error) ? error.fieldErrors : [])
      })
  }

  const disabled = !canWrite
  return (
    <>
      <ProvidersCard
        providers={providers}
        value={provider}
        onChange={setProvider}
        canWrite={canWrite}
      />

      <Card>
        <CardHeader>
          <CardTitle>Automatic booking</CardTitle>
          <CardDescription>
            When on, OMS books paid orders with the default provider once they have waited the
            delay, so a quick cancel never races a booking. It never books with Manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Switch
              id="auto-book"
              checked={autoEffective}
              disabled={disabled || manual}
              onCheckedChange={setAutoOn}
              aria-describedby="auto-book-rule"
            />
            <Label htmlFor="auto-book">{autoEffective ? 'On' : 'Off'}</Label>
          </div>
          <p id="auto-book-rule" className="text-xs text-muted-foreground">
            {manual
              ? 'The default provider is Manual, and automatic booking never uses Manual: it stays off.'
              : `Books paid orders ${asInt(delay) ?? '…'} minutes after payment, with ${providerLabel(provider)}.`}
          </p>
          <div className="grid max-w-xs gap-1.5">
            <Label htmlFor="auto-book-delay">Delay (minutes)</Label>
            <Input
              id="auto-book-delay"
              inputMode="numeric"
              value={delay}
              disabled={disabled || !autoEffective}
              onChange={(e) => setDelay(e.target.value)}
              aria-invalid={problems.delay ? true : undefined}
            />
            {problems.delay && <p className="text-sm text-destructive">{problems.delay}</p>}
          </div>
        </CardContent>
      </Card>

      <PickupCard
        warehouseId={warehouseId}
        saved={current.pickupWarehouse}
        onChange={setWarehouseId}
        disabled={disabled}
      />

      <Card>
        <CardHeader>
          <CardTitle>Fallback package</CardTitle>
          <CardDescription>
            Used for a product with no weight or box in the catalog: one unit&apos;s weight, and
            the box.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          {(
            [
              ['fallback-weight', 'Weight (g)', weight, setWeight, problems.weight],
              ['fallback-length', 'Length (mm)', length, setLength, problems.length],
              ['fallback-width', 'Width (mm)', width, setWidth, problems.width],
              ['fallback-height', 'Height (mm)', height, setHeight, problems.height],
            ] as const
          ).map(([id, label, value, set, problem]) => (
            <div key={id} className="grid gap-1.5">
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                inputMode="numeric"
                value={value}
                disabled={disabled}
                onChange={(e) => set(e.target.value)}
                aria-invalid={problem ? true : undefined}
              />
              {problem && <p className="text-xs text-destructive">{problem}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publish</CardTitle>
          <CardDescription>A new version from the values above, effective at once.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid max-w-md gap-1.5">
            <Label htmlFor="shipping-notes">Notes (optional)</Label>
            <Input
              id="shipping-notes"
              maxLength={1000}
              value={notes}
              disabled={disabled}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {refusal && (
            <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p>{refusal}</p>
              {fieldErrors.map((e) => (
                <p key={`${e.field}-${e.message}`}>
                  {e.field}: {e.message}
                </p>
              ))}
            </div>
          )}
          <div>
            <Button disabled={disabled || !ready || publish.isPending} onClick={() => setConfirmOpen(true)}>
              Publish
            </Button>
            {!canWrite && (
              <p className="mt-1 text-xs text-muted-foreground">
                Publishing needs <code>shipping.settings</code>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Publish shipping settings"
        confirmLabel="Publish"
        pending={publish.isPending}
        onConfirm={submit}
      >
        <p>
          Default provider {providerLabel(provider)}; automatic booking{' '}
          {autoEffective ? `on, after ${asInt(delay)} minutes` : 'off'}; fallback package{' '}
          {grams(asInt(weight))}, {box(asInt(length), asInt(width), asInt(height))}.
        </p>
        {provider !== current.defaultProviderCode && <p>{SWITCH_NOTE}</p>}
      </ConfirmDialog>
    </>
  )
}

function ProvidersCard({
  providers,
  value,
  onChange,
  canWrite,
}: {
  providers: ShippingProvider[]
  value: string
  onChange: (code: string) => void
  canWrite: boolean
}) {
  const test = useTestProviderMutation()
  const [results, setResults] = React.useState<Record<string, ProviderTest | string>>({})

  function runTest(code: string) {
    test
      .mutateAsync(code)
      .then((r) => setResults((prev) => ({ ...prev, [code]: r })))
      .catch((error) =>
        setResults((prev) => ({
          ...prev,
          [code]: isApiError(error) ? error.message : 'The test could not be run.',
        }))
      )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider</CardTitle>
        <CardDescription>{SWITCH_NOTE}</CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset className="flex flex-col gap-3" aria-label="Default provider">
          {providers.map((p) => {
            const blocked = providerBlocked(p)
            const result = results[p.code!]
            const id = `provider-${p.code}`
            return (
              <div key={p.code} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start">
                <input
                  type="radio"
                  id={id}
                  name="default-provider"
                  value={p.code}
                  className="mt-1 size-4"
                  checked={value === p.code}
                  disabled={!canWrite || !!blocked}
                  onChange={() => onChange(p.code!)}
                  aria-describedby={blocked ? `${id}-why` : undefined}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {p.name ?? providerLabel(p.code)}
                    {p.configured ? (
                      <Badge variant="secondary">Configured</Badge>
                    ) : (
                      <Badge variant="outline">Not configured</Badge>
                    )}
                    {p.isDefault && <Badge>Default now</Badge>}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Labels {p.supports?.label ? 'yes' : 'no'} · tracking{' '}
                    {p.supports?.tracking ? 'yes' : 'no'} · cancel {p.supports?.cancel ? 'yes' : 'no'}
                  </p>
                  {blocked && (
                    <p id={`${id}-why`} className="text-xs text-muted-foreground">
                      {blocked}
                    </p>
                  )}
                  {result && (
                    <p
                      role="status"
                      className={
                        typeof result !== 'string' && result.ok
                          ? 'text-sm text-emerald-700 dark:text-emerald-400'
                          : 'text-sm text-destructive'
                      }
                    >
                      {typeof result === 'string' ? result : result.sentence}
                    </p>
                  )}
                </div>
                {p.code !== 'MANUAL' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canWrite || !p.configured || test.isPending}
                    title={canWrite ? undefined : 'Needs shipping.settings'}
                    onClick={() => runTest(p.code!)}
                  >
                    Test connection
                  </Button>
                )}
              </div>
            )
          })}
        </fieldset>
      </CardContent>
    </Card>
  )
}

/**
 * The default pickup warehouse, with what it lacks for a courier booking named and linked. What is
 * missing comes with the settings (`pickupWarehouse.missingContact`), so no warehouse read is made
 * and `warehouse.read` is not needed. It speaks for the warehouse the settings name; a different
 * one picked in the form is checked when it is published.
 */
function PickupCard({
  warehouseId,
  saved,
  onChange,
  disabled,
}: {
  warehouseId: string
  saved: ShippingSettings['pickupWarehouse']
  onChange: (id: string) => void
  disabled: boolean
}) {
  const inEffect = saved && saved.id === warehouseId ? saved : undefined
  const missing = (inEffect?.missingContact ?? []).map((m) => MISSING_CONTACT_LABEL[m])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pickup warehouse</CardTitle>
        <CardDescription>
          Where couriers collect parcels. Each shipment records the warehouse it was picked up from.
          Its contact name, phone and email are needed for courier bookings, not for Manual ones.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {disabled ? (
          <p className="text-sm font-medium">
            {inEffect ? `${inEffect.code} — ${inEffect.name}` : warehouseId || 'None chosen'}
          </p>
        ) : (
          <WarehouseSelect
            id="pickup-warehouse"
            value={warehouseId}
            onChange={onChange}
            ariaLabel="Pickup warehouse"
            activeOnly
            className="w-80"
          />
        )}
        {!warehouseId && (
          <p role="alert" className="text-sm text-destructive">
            No pickup warehouse is chosen: nothing can be booked.
          </p>
        )}
        {inEffect && missing.length > 0 && (
          <p
            role="alert"
            data-testid="pickup-contact-warning"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40"
          >
            {inEffect.name} has no {listInWords(missing)}. A courier cannot be booked from a
            warehouse missing any of the contact name, phone and email; a Manual booking does not
            need them.{' '}
            <Link
              to={`/inventory/warehouses/${inEffect.id}`}
              className="font-medium underline underline-offset-2"
            >
              Add them on the warehouse
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default ShippingSettingsPage
