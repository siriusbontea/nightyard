import { describe, expect, it } from 'vitest'
import { DRAW_PIXELS, FIELD_WIDTH, dist, pixelsToYards, pointOnStroke, simplifyPath, type SimplifyOptions } from './geometry'
import { PHONE_FIELD_PX, DESKTOP_FIELD_PX, curlTrace, outTrace, wheelTrace, zigZagTrace } from './tracePaths'
import type { Point, Stroke } from './types'

function optionsFor(fieldPx: number): { epsilon: number; options: SimplifyOptions } {
  return {
    epsilon: pixelsToYards(DRAW_PIXELS.epsilon, fieldPx),
    options: {
      cornerWindow: pixelsToYards(DRAW_PIXELS.cornerWindow, fieldPx),
      cornerDegrees: DRAW_PIXELS.cornerDegrees,
      minLeg: pixelsToYards(DRAW_PIXELS.minLeg, fieldPx),
      maxPoints: DRAW_PIXELS.maxPoints,
    },
  }
}

function simplifyAt(points: Point[], fieldPx: number) {
  const { epsilon, options } = optionsFor(fieldPx)
  return simplifyPath(points, epsilon, options)
}

function scale(points: Point[], factor: number): Point[] {
  return points.map((point) => ({ x: point.x * factor, y: point.y * factor }))
}

function nearest(points: Point[], target: Point): number {
  return Math.min(...points.map((point) => dist(point, target)))
}

function pattern(curves: (Point | null)[]): string {
  return curves.map((curve) => (curve ? 'c' : 'l')).join('')
}

function asStroke(simplified: { points: Point[]; curves: (Point | null)[] }): Stroke {
  return { id: 's', playerId: 'p', kind: 'route', points: simplified.points, curves: simplified.curves, preset: null }
}

describe('freehand routes', () => {
  it('keeps every break in a rounded zig-zag', () => {
    const raw = zigZagTrace()
    const simplified = simplifyAt(raw, PHONE_FIELD_PX)
    expect(simplified.points.length).toBeGreaterThanOrEqual(5)
    expect(simplified.points.length).toBeLessThanOrEqual(DRAW_PIXELS.maxPoints)
    expect(nearest(simplified.points, { x: 28, y: 6 })).toBeLessThan(1.15)
    expect(nearest(simplified.points, { x: 21, y: 9 })).toBeLessThan(1.15)
    expect(nearest(simplified.points, { x: 30, y: 13 })).toBeLessThan(1.15)
    for (const corner of [
      { x: 28, y: 6 },
      { x: 21, y: 9 },
      { x: 30, y: 13 },
    ]) {
      const index = simplified.points.findIndex((point) => dist(point, corner) < 1.15)
      expect(simplified.curves[index - 1], `${corner.x}`).toBeNull()
      expect(simplified.curves[index], `${corner.x}`).toBeNull()
    }
  })

  it('keeps a 90 degree out as a sharp cut', () => {
    const simplified = simplifyAt(outTrace(), PHONE_FIELD_PX)
    const index = simplified.points.findIndex((point) => dist(point, { x: 12, y: 10 }) < 1)
    expect(index).toBeGreaterThan(0)
    expect(index).toBeLessThan(simplified.points.length - 1)
    expect(simplified.curves[index - 1]).toBeNull()
    expect(simplified.curves[index]).toBeNull()
    const end = simplified.points.at(-1)!
    expect(dist(end, { x: 20, y: 10 })).toBeLessThan(0.6)
    expect(simplified.points.length).toBeLessThanOrEqual(6)
  })

  it('keeps a curl comeback', () => {
    const simplified = simplifyAt(curlTrace(), PHONE_FIELD_PX)
    expect(nearest(simplified.points, { x: 41, y: 11.2 })).toBeLessThan(1.3)
    const end = simplified.points.at(-1)!
    expect(end.y).toBeLessThan(8.6)
    expect(Math.max(...simplified.points.map((point) => point.y))).toBeGreaterThan(10)
    expect(simplified.points.length).toBeLessThanOrEqual(DRAW_PIXELS.maxPoints)
  })

  it('keeps a wheel curved instead of cutting the chord', () => {
    const raw = wheelTrace()
    const simplified = simplifyAt(raw, PHONE_FIELD_PX)
    expect(simplified.curves.some(Boolean)).toBe(true)
    expect(simplified.points.length).toBeLessThanOrEqual(6)
    const stroke = asStroke(simplified)
    const start = simplified.points[0]
    const end = simplified.points.at(-1)!
    let offChord = 0
    let offArc = Infinity
    for (let step = 1; step < 8; step++) {
      const at = pointOnStroke(stroke, step / 8)
      const chord = { x: start.x + (end.x - start.x) * (step / 8), y: start.y + (end.y - start.y) * (step / 8) }
      offChord = Math.max(offChord, dist(at, chord))
      offArc = Math.min(offArc, Math.min(...raw.map((point) => dist(point, at))))
    }
    expect(offChord).toBeGreaterThan(1.6)
    expect(offArc).toBeLessThan(1.2)
  })

  it('drops finger jitter on a straight stem', () => {
    const raw = Array.from({ length: 24 }, (_, index) => ({
      x: 14,
      y: index * 0.35 + (index % 2 === 0 ? 0.1 : -0.1),
    }))
    const simplified = simplifyAt(raw, PHONE_FIELD_PX)
    expect(simplified.points).toHaveLength(2)
    expect(simplified.curves).toEqual([null])
  })

  it('uses the same breaks on a phone and a desktop for the same pixel gesture', () => {
    const factor = PHONE_FIELD_PX / DESKTOP_FIELD_PX
    for (const trace of [zigZagTrace, outTrace, curlTrace, wheelTrace]) {
      const phone = simplifyAt(trace(), PHONE_FIELD_PX)
      const desktop = simplifyAt(scale(trace(), factor), DESKTOP_FIELD_PX)
      expect(desktop.points.length).toBe(phone.points.length)
      expect(pattern(desktop.curves)).toBe(pattern(phone.curves))
    }
    expect(pixelsToYards(DRAW_PIXELS.epsilon, PHONE_FIELD_PX)).toBeCloseTo((6 * FIELD_WIDTH) / PHONE_FIELD_PX, 5)
    expect(pixelsToYards(DRAW_PIXELS.epsilon, DESKTOP_FIELD_PX)).toBeLessThan(pixelsToYards(DRAW_PIXELS.epsilon, PHONE_FIELD_PX))
  })
})
