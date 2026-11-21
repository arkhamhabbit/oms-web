import * as React from 'react'

import { usePincodeLookupQuery } from '@/api/orders'
import { useUserAddressesQuery } from '@/api/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isApiError } from '@/lib/api-error'
import { addressLine, lacksPlace, NO_PLACE_NOTE } from '@/lib/address'
import { isPincode } from '@/lib/orders'
import {
  deliveryProblems,
  TYPED_ADDRESS_NOTE,
  type DeliveryDraft,
  type TypedAddress,
} from '@/lib/new-order'

/** Step 3: one of the member's addresses, or one typed for this order only; an optional delivery mobile. */
function DeliveryChooser({
  memberId,
  memberMobile,
  value,
  onChange,
}: {
  memberId: string | undefined
  memberMobile: string | undefined
  value: DeliveryDraft
  onChange: (next: DeliveryDraft) => void
}) {
  const addresses = useUserAddressesQuery(memberId ?? '')
  const problems = deliveryProblems(value)
  const typed = value.mode === 'typed'
  const setTyped = (patch: Partial<TypedAddress>) =>
    onChange({ ...value, typed: { ...value.typed, ...patch } })
  const list = memberId ? (addresses.data ?? []) : []

  // A six-digit PIN code reads its city and state once: a hit fills both (still editable), a miss
  // or a failed read empties them so the admin types them. Applied once per PIN code, so what the
  // admin then edits is never overwritten.
  const pin = value.typed.pincode.trim()
  const lookup = usePincodeLookupQuery(pin, typed)
  const settled = lookup.isSuccess || lookup.isError
  const applied = React.useRef('')
  React.useEffect(() => {
    if (!isPincode(pin)) {
      applied.current = ''
      return
    }
    if (!typed || !settled || applied.current === pin) {
      return
    }
    applied.current = pin
    onChange({
      ...value,
      typed: { ...value.typed, city: lookup.data?.city ?? '', state: lookup.data?.state ?? '' },
    })
  }, [pin, typed, settled, lookup.data, value, onChange])

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Delivery</CardTitle>
        <CardDescription>Where the order goes, and who the courier calls.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!memberId ? (
          <p className="text-sm text-muted-foreground">Choose a member to see their addresses.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={typed ? 'outline' : 'default'}
                aria-pressed={!typed}
                onClick={() => onChange({ ...value, mode: 'book' })}
              >
                Member’s addresses
              </Button>
              <Button
                size="sm"
                variant={typed ? 'default' : 'outline'}
                aria-pressed={typed}
                onClick={() => onChange({ ...value, mode: 'typed' })}
              >
                Type an address
              </Button>
            </div>

            {!typed && (
              <div role="radiogroup" aria-label="Member’s addresses" className="flex flex-col gap-2">
                {addresses.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {isApiError(addresses.error)
                      ? addresses.error.message
                      : 'The addresses could not be loaded.'}
                  </p>
                )}
                {addresses.isSuccess && list.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    This member has no saved address. Type one for this order.
                  </p>
                )}
                {list.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-[:checked]:border-primary"
                  >
                    <input
                      type="radio"
                      name="address"
                      className="mt-1"
                      checked={value.addressId === a.id}
                      onChange={() => onChange({ ...value, addressId: a.id })}
                    />
                    <span>
                      <span className="font-medium">{a.label || 'Address'}</span>
                      {a.isDefault && <span className="ml-2 text-xs text-muted-foreground">Default</span>}
                      <span className="block">{addressLine(a)}</span>
                      {lacksPlace(a) && (
                        <span className="block text-xs text-muted-foreground">{NO_PLACE_NOTE}</span>
                      )}
                      <span className="block text-muted-foreground">{a.deliveryMobile}</span>
                    </span>
                  </label>
                ))}
                {problems.address && list.length > 0 && (
                  <p className="text-xs text-muted-foreground">{problems.address}</p>
                )}
              </div>
            )}

            {typed && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="addr-label">Label</Label>
                  <Input
                    id="addr-label"
                    value={value.typed.label}
                    onChange={(e) => setTyped({ label: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="addr-pincode">Pincode</Label>
                  <Input
                    id="addr-pincode"
                    inputMode="numeric"
                    maxLength={6}
                    value={value.typed.pincode}
                    aria-invalid={value.typed.pincode !== '' && !!problems.pincode ? true : undefined}
                    onChange={(e) => setTyped({ pincode: e.target.value })}
                  />
                  {value.typed.pincode !== '' && problems.pincode && (
                    <p className="text-xs text-destructive">{problems.pincode}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="addr-city">City</Label>
                  <Input
                    id="addr-city"
                    value={value.typed.city}
                    onChange={(e) => setTyped({ city: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="addr-state">State</Label>
                  <Input
                    id="addr-state"
                    value={value.typed.state}
                    onChange={(e) => setTyped({ state: e.target.value })}
                  />
                </div>
                {isPincode(pin) && problems.place && !lookup.isFetching && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">{problems.place}</p>
                )}
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="addr-line1">Address line 1</Label>
                  <Input
                    id="addr-line1"
                    value={value.typed.line1}
                    onChange={(e) => setTyped({ line1: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="addr-landmark">Landmark</Label>
                  <Input
                    id="addr-landmark"
                    value={value.typed.landmark}
                    onChange={(e) => setTyped({ landmark: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">{TYPED_ADDRESS_NOTE}</p>
              </div>
            )}

            <div className="grid max-w-xs gap-1.5">
              <Label htmlFor="delivery-mobile">Delivery mobile (optional)</Label>
              <Input
                id="delivery-mobile"
                inputMode="tel"
                placeholder={memberMobile ?? '+91…'}
                value={value.mobile}
                aria-invalid={problems.mobile ? true : undefined}
                onChange={(e) => onChange({ ...value, mobile: e.target.value })}
              />
              {problems.mobile ? (
                <p className="text-xs text-destructive">{problems.mobile}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Left empty, the courier calls {typed ? 'the member' : 'the address’s number'}
                  {memberMobile ? ` (${memberMobile})` : ''}.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export { DeliveryChooser }
