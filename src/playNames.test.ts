import { describe, expect, it } from 'vitest'
import { formationBlurb } from './formations'
import { isGeneratedName, numberedName } from './playNames'

describe('play names', () => {
  it('numbers a new play from the lineup', () => {
    expect(numberedName([], 'Shotgun Trips')).toBe('Shotgun Trips 1')
    expect(numberedName(['Shotgun Trips 1', 'Punt 1'], 'Shotgun Trips')).toBe('Shotgun Trips 2')
    expect(numberedName(['Punt 1'], 'Punt')).toBe('Punt 2')
  })

  it('treats generated names as renameable, and leaves a custom name alone', () => {
    expect(isGeneratedName('Shotgun Trips 1')).toBe(true)
    expect(isGeneratedName('Punt 2')).toBe(true)
    expect(isGeneratedName('New play')).toBe(true)
    expect(isGeneratedName('Corndog')).toBe(false)
    expect(isGeneratedName('Stick')).toBe(false)
    expect(isGeneratedName('Red zone')).toBe(false)
  })
})

describe('lineup descriptions', () => {
  it('gives every tackle and flag look a one-line explanation', () => {
    for (const [format, id] of [
      ['11v11', 'trips-bunch'],
      ['11v11', 'shotgun-trips'],
      ['11v11', 'ace'],
      ['11v11', 'i-form'],
      ['11v11', 'punt'],
      ['11v11', 'kickoff'],
      ['5v5', 'doubles'],
      ['6v6', 'wing'],
      ['8v8', 'pro'],
    ] as const) {
      const line = formationBlurb(format, id)
      expect(line.length).toBeGreaterThan(12)
      expect(line.endsWith('.')).toBe(true)
    }
  })
})
