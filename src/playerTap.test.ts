import { describe, expect, it } from 'vitest'
import { tapOpensPosition } from './playerTap'

describe('tap opens the position list', () => {
  it('opens on the first finger tap, selected or not', () => {
    expect(tapOpensPosition('touch', false)).toBe(true)
    expect(tapOpensPosition('touch', true)).toBe(true)
    expect(tapOpensPosition('pen', false)).toBe(true)
  })

  it('keeps a desktop double-click: the first click selects, the second opens', () => {
    expect(tapOpensPosition('mouse', false)).toBe(false)
    expect(tapOpensPosition('mouse', true)).toBe(true)
  })
})
