import { describe, expect, it } from 'vitest'

import { majorStringToMinor, minorToMajorString } from '@/lib/money'

describe('minorToMajorString', () => {
  it('formats whole rupees with two decimal places', () => {
    expect(minorToMajorString(449900)).toBe('4499.00')
  })

  it('pads a single-digit minor remainder', () => {
    expect(minorToMajorString(100005)).toBe('1000.05')
  })

  it('formats zero', () => {
    expect(minorToMajorString(0)).toBe('0.00')
  })

  it('formats negative amounts', () => {
    expect(minorToMajorString(-15099)).toBe('-150.99')
  })
})

describe('majorStringToMinor', () => {
  it('parses a plain integer', () => {
    expect(majorStringToMinor('4499')).toBe(449900)
  })

  it('parses two decimal places exactly', () => {
    expect(majorStringToMinor('4499.50')).toBe(449950)
  })

  it('pads a single decimal place', () => {
    expect(majorStringToMinor('4499.5')).toBe(449950)
  })

  it('strips thousands separators', () => {
    expect(majorStringToMinor('4,499.50')).toBe(449950)
  })

  it('returns null for empty input', () => {
    expect(majorStringToMinor('')).toBeNull()
  })

  it('returns null for more than two decimal places', () => {
    expect(majorStringToMinor('4499.999')).toBeNull()
  })

  it('returns null for non-numeric input', () => {
    expect(majorStringToMinor('abc')).toBeNull()
  })

  it('round-trips without floating-point drift across a wide range of amounts', () => {
    const amounts = [0, 1, 99, 100, 12345, 449900, 999999999]
    for (const minor of amounts) {
      expect(majorStringToMinor(minorToMajorString(minor))).toBe(minor)
    }
  })
})
