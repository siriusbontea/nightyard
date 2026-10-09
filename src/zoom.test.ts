import { describe, expect, it } from 'vitest'
import { isDoubleTap, isPinch } from './zoom'

describe('zoom gestures', () => {
  it('blocks a second tap on the same spot inside 300ms', () => {
    const first = { t: 1000, x: 40, y: 80 }
    expect(isDoubleTap(first, 1200, 48, 86)).toBe(true)
    expect(isDoubleTap(first, 1200, 90, 80)).toBe(false)
    expect(isDoubleTap(first, 1400, 40, 80)).toBe(false)
    expect(isDoubleTap(null, 1200, 40, 80)).toBe(false)
  })

  it('treats two or more touches as a pinch', () => {
    expect(isPinch(1)).toBe(false)
    expect(isPinch(2)).toBe(true)
  })
})
