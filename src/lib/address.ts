/**
 * One address as one line, "{line1}, {landmark}, {city}, {state} {pincode}", with only what is
 * served: a missing part is left out, never guessed (D5.15).
 */
export function addressLine(a: {
  line1?: string | null
  landmark?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
}): string {
  const head = [a.line1, a.landmark, a.city, a.state].map((p) => p?.trim()).filter(Boolean).join(', ')
  return [head, a.pincode?.trim()].filter(Boolean).join(' ')
}

/** True when the address carries neither a city nor a state. */
export const lacksPlace = (a: { city?: string | null; state?: string | null }): boolean =>
  !a.city?.trim() && !a.state?.trim()

export const NO_PLACE_NOTE = 'No city or state on this address'
