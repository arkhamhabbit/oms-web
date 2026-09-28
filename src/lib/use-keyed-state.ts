import * as React from 'react'

/**
 * `useState` that re-initializes whenever `key` changes, computed during render rather than in a
 * `useEffect` — the same "adjust state during rendering" trick `MoneyInput.tsx` already uses to
 * resync free-typed text when its controlled `valueMinor` prop moves. Doing the reset in an effect
 * would fire a `setState` synchronously inside the effect body, which is exactly what
 * `react-hooks/set-state-in-effect` flags: it costs an extra render pass for something render-time
 * can settle in one. `key` is typically an identity/version marker (e.g. `variant.id` combined
 * with `variant.version`) rather than the full initial value, so an in-place edit to the returned
 * state doesn't itself trigger a reset.
 */
export function useKeyedState<T>(
  key: unknown,
  computeInitial: () => T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState(computeInitial)
  // Tracked in state, not a ref — `react-hooks/refs` forbids reading/writing a ref during render,
  // and this check has to run during render (see the module doc comment above).
  const [syncedKey, setSyncedKey] = React.useState(key)
  if (!Object.is(syncedKey, key)) {
    setSyncedKey(key)
    setState(computeInitial())
  }
  return [state, setState]
}
