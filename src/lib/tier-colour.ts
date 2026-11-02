/** `#RRGGBB`, either case — the one shape the server accepts for a tier's colour (D7.18). */
const HEX = /^#[0-9A-Fa-f]{6}$/

export function isTierColour(value: string | undefined | null): value is string {
  return !!value && HEX.test(value)
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  )
}

/** Black or white text, whichever reads better on the tier's colour. */
export function readableTextOn(hex: string): '#111111' | '#ffffff' {
  const l = luminance(hex)
  // Contrast against white is 1.05 / (l + 0.05); against #111 it is (l + 0.05) / 0.0556.
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.0556 ? '#ffffff' : '#111111'
}

/** The picker needs a valid `#RRGGBB`; an empty or half-typed field shows a neutral value. */
export function swatchValue(hex: string): string {
  return isTierColour(hex) ? hex.toLowerCase() : '#000000'
}
