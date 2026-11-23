/**
 * Settings that are read when the page loads, not when the app is built (W4.0).
 *
 * In a container, `/config.js` is written at start from the environment (`OMS_API_BASE_URL`,
 * `MEDIA_ORIGIN`) and sets `window.__OMS_CONFIG__` before the app script runs. In local
 * development `public/config.js` is an empty stub, so nothing is set and `VITE_API_BASE_URL`
 * (or the localhost default) applies exactly as before.
 */

export const API_BASE_URL_VARIABLE = 'OMS_API_BASE_URL'
export const MEDIA_ORIGIN_VARIABLE = 'MEDIA_ORIGIN'

const DEV_DEFAULT_API_BASE_URL = 'http://localhost:8080'

export interface RuntimeConfigShape {
  apiBaseUrl?: unknown
  mediaOrigin?: unknown
}

declare global {
  interface Window {
    __OMS_CONFIG__?: RuntimeConfigShape
  }
}

export type ConfigResult = { ok: true; apiBaseUrl: string } | { ok: false; message: string }

/** An absolute http(s) address with a host and nothing after the origin but an optional `/`. */
function parseOrigin(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname) return null
  if (url.username || url.password || url.search || url.hash) return null
  if (url.pathname !== '/') return null
  return url.origin
}

/**
 * Pure: decides the API address from what the page was given. `runtime` is
 * `window.__OMS_CONFIG__`; `dev` is true under `npm run dev` / vitest, where an unset value
 * falls back to `VITE_API_BASE_URL`, then to localhost.
 */
export function resolveConfig(
  runtime: RuntimeConfigShape | undefined,
  options: { dev: boolean; viteApiBaseUrl?: string }
): ConfigResult {
  const hasRuntimeValue = runtime !== undefined && 'apiBaseUrl' in runtime

  if (!hasRuntimeValue) {
    if (options.dev) {
      return { ok: true, apiBaseUrl: options.viteApiBaseUrl || DEV_DEFAULT_API_BASE_URL }
    }
    return {
      ok: false,
      message:
        `The console's settings file (config.js) was not loaded, so the OMS address is unknown. ` +
        `Set ${API_BASE_URL_VARIABLE} on the server that runs this console and restart it.`,
    }
  }

  const raw = runtime.apiBaseUrl
  if (typeof raw !== 'string' || raw.trim() === '') {
    return {
      ok: false,
      message:
        `${API_BASE_URL_VARIABLE} is not set. Set it to the address of the OMS, for example ` +
        `https://oms-test.habbithealth.com, and restart the console.` +
        mediaNote(runtime),
    }
  }
  const origin = parseOrigin(raw.trim())
  if (origin === null) {
    return {
      ok: false,
      message:
        `${API_BASE_URL_VARIABLE} is not a usable address ("${raw.trim().slice(0, 80)}"). It must be ` +
        `a full http:// or https:// address with no path, for example https://oms-test.habbithealth.com.`,
    }
  }
  return { ok: true, apiBaseUrl: origin }
}

/** The media origin is optional; when it is missing the page says images are limited to this app. */
function mediaNote(runtime: RuntimeConfigShape): string {
  const media = runtime.mediaOrigin
  if (typeof media === 'string' && media.trim() !== '') return ''
  return (
    ` ${MEDIA_ORIGIN_VARIABLE} is also not set: until it is, images are allowed from this ` +
    `console's own address and inline data only, so product and content images will not show.`
  )
}

export function readConfig(): ConfigResult {
  return resolveConfig(window.__OMS_CONFIG__, {
    dev: import.meta.env.DEV,
    viteApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  })
}

/** What the API client is built with. Never throws: an unusable value is reported by `main.tsx`. */
export function apiBaseUrl(): string {
  const result = readConfig()
  return result.ok ? result.apiBaseUrl : ''
}
