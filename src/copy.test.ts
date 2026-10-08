import { describe, expect, it } from 'vitest'
import { plainPreset } from './presets'
import { FORMATS, formatLabel, formatShort, formatStyle } from './types'

describe('kid-facing words', () => {
  it('keeps the printed format name and adds a short count', () => {
    expect(formatLabel('11v11')).toBe('11v11 tackle')
    expect(formatLabel('5v5')).toBe('5v5 flag')
    expect(formatShort('5v5')).toBe('5 on 5')
    expect(formatShort('11v11')).toBe('11 on 11')
    expect(formatStyle('8v8')).toBe('flag')
    expect(formatStyle('11v11')).toBe('tackle')
    expect(FORMATS).toHaveLength(6)
  })

  it('puts a plain word under each path name', () => {
    expect(plainPreset('slant')).toBe('Cut in')
    expect(plainPreset('go')).toBe('Straight')
    expect(plainPreset('block')).toBe('Stop them')
    expect(plainPreset('motion')).toBe('Before')
  })
})
