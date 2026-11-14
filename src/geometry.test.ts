import { describe, expect, it } from 'vitest'
import {
  cameraForBox,
  FIELD_WIDTH,
  dist,
  distanceToStroke,
  fieldToSvg,
  insideDir,
  pointOnStroke,
  segmentPoint,
  simplifyPath,
  strokeLength,
  translateStroke,
} from './geometry'
import { presetPath } from './presets'
import type { Stroke } from './types'

function stroke(points: Stroke['points'], curves: Stroke['curves']): Stroke {
  return { id: 's', playerId: 'p', kind: 'route', points, curves, preset: null }
}

describe('route geometry', () => {
  it('samples a straight segment at the midpoint and a curve off the chord', () => {
    const linear = segmentPoint({ x: 0, y: 0 }, { x: 10, y: 0 }, null, 0.5)
    expect(linear).toEqual({ x: 5, y: 0 })
    const curved = segmentPoint({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }, 0.5)
    expect(curved.x).toBeCloseTo(5)
    expect(curved.y).toBeCloseTo(5)
    expect(curved.y).not.toBeCloseTo(linear.y)
  })

  it('walks a stroke from its start to its end by arc length', () => {
    const route = stroke(
      [
        { x: 0, y: 0 },
        { x: 0, y: 6 },
        { x: 8, y: 6 },
      ],
      [null, null],
    )
    expect(pointOnStroke(route, 0)).toEqual({ x: 0, y: 0 })
    expect(pointOnStroke(route, 1)).toEqual({ x: 8, y: 6 })
    expect(strokeLength(route)).toBeCloseTo(14, 0)
    const mid = pointOnStroke(route, 6 / 14)
    expect(mid.x).toBeCloseTo(0, 0)
    expect(mid.y).toBeCloseTo(6, 0)
  })

  it('maps upfield yards toward the top of the screen', () => {
    const camera = { ahead: 30, behind: 16, scale: 10 }
    expect(fieldToSvg({ x: 0, y: 0 }, camera).y).toBe(300)
    expect(fieldToSvg({ x: 0, y: 10 }, camera).y).toBe(200)
  })

  it('fills a tall phone with the same aspect as the frame and stays on the marked field', () => {
    const width = 360
    const height = 640
    const camera = cameraForBox(width, height, 50)
    const depth = camera.ahead + camera.behind
    expect(depth).toBeCloseTo((FIELD_WIDTH * height) / width, 5)
    expect(camera.ahead).toBeLessThanOrEqual(60)
    expect(-camera.behind).toBeGreaterThanOrEqual(-60)
    expect(camera.behind).toBeGreaterThan(12)
    const depthPx = camera.ahead + camera.behind
    const losFromTop = camera.ahead / depthPx
    expect(losFromTop).toBeGreaterThan(0.25)
    expect(losFromTop).toBeLessThan(0.75)
    const wide = cameraForBox(980, 420, 50)
    expect(wide.ahead + wide.behind).toBeCloseTo((FIELD_WIDTH * 420) / 980, 5)
    expect(wide.ahead).toBeGreaterThan(0)
    expect(wide.behind).toBeGreaterThan(0)
  })

  it('sends slants inside and outs outside', () => {
    expect(insideDir(10)).toBe(1)
    expect(insideDir(40)).toBe(-1)
    const slant = presetPath('slant', { x: 40, y: 0 }, -1)
    expect(slant.points.at(-1)!.x).toBeLessThan(40)
    expect(slant.curves.every((curve) => curve === null)).toBe(true)
    const out = presetPath('out', { x: 40, y: 0 }, -1)
    expect(out.points.at(-1)!.x).toBeGreaterThan(40)
    const go = presetPath('go', { x: 12, y: 1 }, 1)
    expect(go.points[1].x).toBe(12)
    expect(go.points[1].y - go.points[0].y).toBeGreaterThan(12)
    expect(strokeLength(stroke(go.points, go.curves))).toBeCloseTo(15, 0)
  })

  it('curves a corner back toward the sideline and a curl back toward the ball', () => {
    const corner = presetPath('corner', { x: 8, y: 0 }, 1)
    expect(corner.points.at(-1)!.x).toBeLessThan(8)
    expect(corner.curves.some(Boolean)).toBe(true)
    const curl = presetPath('curl', { x: 10, y: 0 }, 1)
    const stem = curl.points[1]
    const end = curl.points.at(-1)!
    expect(end.y).toBeLessThan(stem.y)
    const wheel = presetPath('wheel', { x: 30, y: 0 }, -1)
    expect(wheel.curves.some(Boolean)).toBe(true)
    expect(wheel.points.at(-1)!.x).toBeGreaterThan(30)
  })

  it('keeps a block long enough to read and motion flat', () => {
    const block = presetPath('block', { x: 26, y: 0 }, 1)
    expect(dist(block.points[0], block.points.at(-1)!)).toBeGreaterThan(4)
    const motion = presetPath('motion', { x: 30, y: -1 }, -1)
    expect(motion.points[1].y).toBeCloseTo(-1)
    expect(motion.points[1].x).toBeLessThan(30)
  })

  it('translates every point and curve control', () => {
    const moved = translateStroke(
      stroke(
        [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
        [{ x: 2, y: 6 }],
      ),
      5,
      -2,
    )
    expect(moved.points[0]).toEqual({ x: 6, y: 0 })
    expect(moved.points[1]).toEqual({ x: 8, y: 2 })
    expect(moved.curves[0]).toEqual({ x: 7, y: 4 })
  })

  it('collapses a straight freehand line and keeps a soft bow as a curve', () => {
    const straight = Array.from({ length: 18 }, (_, index) => ({ x: index * 0.4, y: index * 0.2 }))
    const simplified = simplifyPath(straight, 0.45)
    expect(simplified.points).toHaveLength(2)
    expect(simplified.curves).toEqual([null])

    const bow = []
    for (let i = 0; i <= 16; i++) {
      bow.push({ x: i * 0.5, y: Math.sin((i / 16) * Math.PI) * 2.2 })
    }
    const curved = simplifyPath(bow, 0.45)
    expect(curved.curves.some((curve) => curve !== null)).toBe(true)
  })

  it('keeps a hard out-break as a corner', () => {
    const raw = []
    for (let i = 0; i <= 10; i++) raw.push({ x: 0, y: i })
    for (let i = 1; i <= 10; i++) raw.push({ x: i, y: 10 })
    const corner = simplifyPath(raw, 0.6)
    expect(corner.points.length).toBeGreaterThanOrEqual(3)
    expect(corner.curves.every((curve) => curve === null)).toBe(true)
  })

  it('measures distance to a stroke', () => {
    const route = stroke(
      [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
      ],
      [null],
    )
    expect(distanceToStroke(route, { x: 0.2, y: 4 })).toBeLessThan(0.3)
    expect(distanceToStroke(route, { x: 5, y: 4 })).toBeGreaterThan(4)
  })
})
