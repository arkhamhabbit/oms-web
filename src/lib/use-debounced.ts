import * as React from 'react'

/** The value, once it has stayed the same for `delayMs`. */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = React.useState(value)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

/** The current time, refreshed every `everyMs`, for a countdown. */
export function useNow(everyMs = 15_000): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(timer)
  }, [everyMs])
  return now
}
