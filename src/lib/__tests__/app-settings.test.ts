import { describe, expect, it } from 'vitest'

import { navItems } from '@/layouts/nav-items'
import {
  APP_SETTINGS_FIELDS,
  isOpenable,
  sameAsRecord,
  toForm,
  toRequest,
} from '@/lib/app-settings'

describe('app settings request', () => {
  it('always sends every one of the seventeen fields and the version', () => {
    const request = toRequest(toForm(undefined), 4)
    expect(APP_SETTINGS_FIELDS).toHaveLength(17)
    expect(Object.keys(request).sort()).toEqual(
      [...APP_SETTINGS_FIELDS.map((f) => f.key), 'version'].sort()
    )
    expect(request.version).toBe(4)
  })

  it('sends an empty or blank field as null, never omitted or an empty string', () => {
    const form = { ...toForm(undefined), supportEmail: 'hello@habbithealth.com', aboutUrl: '   ' }
    const request = toRequest(form, 0)
    expect(request.supportEmail).toBe('hello@habbithealth.com')
    expect(request.aboutUrl).toBeNull()
    expect(request.faqUrl).toBeNull()
    expect(Object.values(request).filter((v) => v === '')).toHaveLength(0)
  })

  it('keeps the other fields of the record when one is changed', () => {
    const record = { version: 2, faqUrl: 'https://example.com/faq', supportEmail: 'a@b.co' }
    const request = toRequest({ ...toForm(record), supportEmail: '' }, 2)
    expect(request.faqUrl).toBe('https://example.com/faq')
    expect(request.supportEmail).toBeNull()
  })

  it('knows a form that changes nothing', () => {
    const record = { version: 1, supportEmail: 'a@b.co' }
    expect(sameAsRecord(toForm(record), record)).toBe(true)
    expect(sameAsRecord({ ...toForm(record), supportEmail: '' }, record)).toBe(false)
    expect(sameAsRecord({ ...toForm(record), xUrl: '  ' }, record)).toBe(true)
  })
})

describe('Open is enabled only for an https value', () => {
  it.each([
    ['https://example.com', true],
    ['https://wa.me/910000000000', true],
    ['http://example.com', false],
    ['HTTPS://example.com', false],
    ['https://', false],
    ['https://a b', false],
    ['mailto:a@b.co', false],
    ['', false],
  ])('%s -> %s', (value, expected) => {
    expect(isOpenable(value)).toBe(expected)
  })
})

describe('nav entry', () => {
  it('is gated by app_settings.read', () => {
    const entry = navItems.find((i) => i.to === '/settings/app')
    expect(entry?.label).toBe('App settings')
    expect(entry?.permission).toBe('app_settings.read')
  })
})
