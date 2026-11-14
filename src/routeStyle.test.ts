import { describe, expect, it } from 'vitest'
import { clampToField, tidyStroke } from './geometry'
import { routeInk } from './routeStyle'

describe('route ink', () => {
  it('uses phone pixels under 720px and desktop pixels above', () => {
    const phone = routeInk(0.675, 390)
    expect(phone.phone).toBe(true)
    expect(phone.stroke * 0.675).toBeCloseTo(3.2, 1)
    expect(phone.head * 0.675).toBeCloseTo(11, 1)
    expect(phone.trim).toBeCloseTo(phone.head * 0.7, 2)

    const desk = routeInk(1.46, 1100)
    expect(desk.phone).toBe(false)
    expect(desk.stroke * 1.46).toBeCloseTo(4, 1)
    expect(desk.head * 1.46).toBeCloseTo(13, 1)
    expect(desk.halo * 1.46).toBeCloseTo(1.25, 1)
  })
})

describe('drawn routes stay on the field', () => {
  it('clamps a route that would leave the end zone', () => {
    const spot = clampToField({ x: 65, y: 80 }, 3)
    expect(spot.x).toBeLessThanOrEqual(52.2)
    expect(spot.x).toBeGreaterThanOrEqual(1.2)
    expect(spot.y).toBeLessThanOrEqual(3 + 10)
  })

  it('snaps a nearly vertical line and leaves a real curve alone', () => {
    const tidy = tidyStroke(
      [
        { x: 10, y: 0 },
        { x: 10.4, y: 8 },
      ],
      [null],
    )
    expect(tidy.points[1].x).toBeCloseTo(10, 1)
    const curved = tidyStroke(
      [
        { x: 10, y: 0 },
        { x: 14, y: 6 },
      ],
      [{ x: 10, y: 4 }],
    )
    expect(curved.points[1].x).toBeCloseTo(14, 2)
  })
})
