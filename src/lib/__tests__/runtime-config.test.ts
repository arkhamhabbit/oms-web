import { describe, expect, it } from 'vitest'

import { readConfig, resolveConfig } from '@/lib/runtime-config'

const prod = { dev: false }

describe('resolveConfig: the address was set when the container started', () => {
  it('uses the runtime value, reduced to its origin', () => {
    expect(resolveConfig({ apiBaseUrl: 'https://oms-test.habbithealth.com' }, prod)).toEqual({
      ok: true,
      apiBaseUrl: 'https://oms-test.habbithealth.com',
    })
    expect(resolveConfig({ apiBaseUrl: ' http://localhost:8080/ ' }, prod)).toEqual({
      ok: true,
      apiBaseUrl: 'http://localhost:8080',
    })
  })

  it('prefers the runtime value over VITE_API_BASE_URL', () => {
    const result = resolveConfig(
      { apiBaseUrl: 'https://oms-test.habbithealth.com' },
      { dev: true, viteApiBaseUrl: 'http://elsewhere:1' }
    )
    expect(result).toEqual({ ok: true, apiBaseUrl: 'https://oms-test.habbithealth.com' })
  })
})

describe('resolveConfig: missing', () => {
  it.each([[null], [''], ['   '], [undefined], [42]])('names the variable for %j', (value) => {
    const result = resolveConfig({ apiBaseUrl: value }, prod)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('OMS_API_BASE_URL')
  })

  it('says images are limited when MEDIA_ORIGIN is also not set', () => {
    const result = resolveConfig({ apiBaseUrl: null, mediaOrigin: null }, prod)
    expect(!result.ok && result.message).toContain('MEDIA_ORIGIN')
    expect(!result.ok && result.message).toContain('own address')
  })

  it('does not mention MEDIA_ORIGIN when it is set', () => {
    const result = resolveConfig({ apiBaseUrl: null, mediaOrigin: 'https://cdn.example' }, prod)
    expect(!result.ok && result.message).not.toContain('MEDIA_ORIGIN')
  })

  it('refuses a production page that never loaded config.js, and never falls back to localhost', () => {
    const result = resolveConfig(undefined, { dev: false, viteApiBaseUrl: 'http://localhost:8080' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('OMS_API_BASE_URL')
  })
})

describe('resolveConfig: malformed', () => {
  it.each([
    'oms-test.habbithealth.com',
    'ftp://oms.example.com',
    'https://',
    'https://oms.example.com/api',
    'https://oms.example.com/?x=1',
    'https://user:pw@oms.example.com',
    'javascript:alert(1)',
    '(unreadable value)',
  ])('rejects %s and names the variable', (value) => {
    const result = resolveConfig({ apiBaseUrl: value }, prod)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('OMS_API_BASE_URL')
  })
})

describe('local development is unchanged', () => {
  it('uses VITE_API_BASE_URL when nothing is set at runtime', () => {
    expect(resolveConfig({}, { dev: true, viteApiBaseUrl: 'http://localhost:9090' })).toEqual({
      ok: true,
      apiBaseUrl: 'http://localhost:9090',
    })
  })

  it('falls back to http://localhost:8080 with nothing at all', () => {
    expect(resolveConfig(undefined, { dev: true })).toEqual({
      ok: true,
      apiBaseUrl: 'http://localhost:8080',
    })
  })

  it('readConfig under vitest (dev mode, no config.js) resolves without a runtime value', () => {
    expect(readConfig().ok).toBe(true)
  })
})
