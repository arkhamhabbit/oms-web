import { describe, expect, it } from 'vitest'

import { slugify } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Whey Protein')).toBe('whey-protein')
  })

  it('folds accented characters instead of stripping them', () => {
    expect(slugify('Café Bar')).toBe('cafe-bar')
  })

  it('collapses runs of non-alphanumeric characters into one hyphen', () => {
    expect(slugify('Fast & Up!!')).toBe('fast-up')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('-Boldfit-')).toBe('boldfit')
  })
})
