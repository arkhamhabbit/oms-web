import { describe, expect, it } from 'vitest'

import { isTierColour, readableTextOn, swatchValue } from '@/lib/tier-colour'

describe('tier colour', () => {
  it('accepts #RRGGBB in either case and nothing else', () => {
    expect(isTierColour('#00BACC')).toBe(true)
    expect(isTierColour('#00bacc')).toBe(true)
    for (const bad of ['', '00BACC', '#00BAC', '#00BACCC', '#GGGGGG', undefined, null]) {
      expect(isTierColour(bad)).toBe(false)
    }
  })

  it('picks the text colour that reads on the background', () => {
    expect(readableTextOn('#000000')).toBe('#ffffff')
    expect(readableTextOn('#FFFFFF')).toBe('#111111')
    expect(readableTextOn('#00BACC')).toBe('#111111')
    expect(readableTextOn('#714956')).toBe('#ffffff')
  })

  it('gives the colour picker a valid value while the field is empty or half typed', () => {
    expect(swatchValue('#8E88BF')).toBe('#8e88bf')
    expect(swatchValue('#8E8')).toBe('#000000')
  })
})
