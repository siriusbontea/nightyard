import { describe, expect, it } from 'vitest'
import { displayedYard, fieldYAt, numberArrow } from './fieldMarks'

describe('yard numbers', () => {
  it('counts up to midfield and back down', () => {
    expect(displayedYard(10)).toBe(10)
    expect(displayedYard(40)).toBe(40)
    expect(displayedYard(50)).toBe(50)
    expect(displayedYard(60)).toBe(40)
    expect(displayedYard(90)).toBe(10)
  })

  it('points the arrow at the nearer goal and leaves the 50 alone', () => {
    expect(numberArrow(40)).toBe('up')
    expect(numberArrow(50)).toBeNull()
    expect(numberArrow(60)).toBe('down')
    expect(fieldYAt(50, 50)).toBe(0)
    expect(fieldYAt(50, 0)).toBe(50)
    expect(fieldYAt(50, 100)).toBe(-50)
  })
})
