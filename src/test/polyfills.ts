/**
 * jsdom lacks the pointer-capture and scroll APIs Radix Select calls when it opens. Installing
 * no-ops lets a test open a select and click an option the way an operator would.
 */
export function installRadixPolyfills(): void {
  const proto = Element.prototype as unknown as Record<string, unknown>
  proto.hasPointerCapture ??= () => false
  proto.setPointerCapture ??= () => undefined
  proto.releasePointerCapture ??= () => undefined
  proto.scrollIntoView ??= () => undefined
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
