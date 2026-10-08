import type { Point } from './types'

/** Seeded jitter so a synthetic finger drag is stable in tests and screenshots. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Walk a polyline the way a finger does: straight legs, a rounded corner
 * instead of a perfect kink, then a sample every `step` yards along that
 * path so a cut is several small turns, plus a little sideways jitter.
 */
export function fingerTrace(corners: Point[], step: number, radius: number, seed: number, jitter: number): Point[] {
  const dense: Point[] = []
  const push = (point: Point) => {
    const last = dense[dense.length - 1]
    if (!last || dist(last, point) >= 0.04) dense.push(point)
  }
  let cursor = corners[0]
  push(cursor)
  for (let k = 1; k < corners.length - 1; k++) {
    const prev = corners[k - 1]
    const corner = corners[k]
    const next = corners[k + 1]
    const legIn = dist(prev, corner)
    const legOut = dist(corner, next)
    const r = Math.min(radius, legIn * 0.46, legOut * 0.46)
    const inDir = { x: (corner.x - prev.x) / legIn, y: (corner.y - prev.y) / legIn }
    const outDir = { x: (next.x - corner.x) / legOut, y: (next.y - corner.y) / legOut }
    const entry = { x: corner.x - inDir.x * r, y: corner.y - inDir.y * r }
    const exit = { x: corner.x + outDir.x * r, y: corner.y + outDir.y * r }
    const leg = dist(cursor, entry)
    const legSteps = Math.max(1, Math.ceil(leg / 0.05))
    for (let i = 1; i <= legSteps; i++) {
      const t = i / legSteps
      push({ x: cursor.x + (entry.x - cursor.x) * t, y: cursor.y + (entry.y - cursor.y) * t })
    }
    const arcSteps = Math.max(8, Math.ceil((r * 2) / 0.05))
    for (let i = 1; i <= arcSteps; i++) {
      const t = i / arcSteps
      const o = 1 - t
      push({
        x: o * o * entry.x + 2 * o * t * corner.x + t * t * exit.x,
        y: o * o * entry.y + 2 * o * t * corner.y + t * t * exit.y,
      })
    }
    cursor = exit
  }
  const end = corners[corners.length - 1]
  const tail = dist(cursor, end)
  const tailSteps = Math.max(1, Math.ceil(tail / 0.05))
  for (let i = 1; i <= tailSteps; i++) {
    const t = i / tailSteps
    push({ x: cursor.x + (end.x - cursor.x) * t, y: cursor.y + (end.y - cursor.y) * t })
  }

  const rand = mulberry32(seed)
  const sampled: Point[] = [{ ...dense[0] }]
  let walked = 0
  for (let i = 1; i < dense.length; i++) {
    walked += dist(dense[i - 1], dense[i])
    if (walked < step && i < dense.length - 1) continue
    walked = 0
    const sideways = unitPerp(dense[i - 1], dense[i])
    const kick = (rand() - 0.5) * 2 * jitter
    sampled.push({ x: dense[i].x + sideways.x * kick, y: dense[i].y + sideways.y * kick })
  }
  sampled[0] = { ...corners[0] }
  sampled[sampled.length - 1] = { ...corners[corners.length - 1] }
  return sampled
}

function unitPerp(a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: -dy / len, y: dx / len }
}

/** Phone field width used to turn a pixel gesture into yards. */
export const PHONE_FIELD_PX = 360

/** Wider desktop field, same 53⅓-yard width, so a yard is more pixels. */
export const DESKTOP_FIELD_PX = 980

/** Three cuts. Each break should survive simplification. */
export function zigZagTrace(step = 0.28): Point[] {
  return fingerTrace(
    [
      { x: 28, y: 0 },
      { x: 28, y: 6 },
      { x: 21, y: 9 },
      { x: 30, y: 13 },
      { x: 22, y: 17 },
    ],
    step,
    1.35,
    11,
    0.05,
  )
}

/** Stem up, then a 90° cut to the sideline. */
export function outTrace(step = 0.28): Point[] {
  return fingerTrace(
    [
      { x: 12, y: 0 },
      { x: 12, y: 10 },
      { x: 20, y: 10 },
    ],
    step,
    1.2,
    23,
    0.05,
  )
}

/** Stem, hook away from the ball, and a comeback toward the line. */
export function curlTrace(step = 0.28): Point[] {
  return fingerTrace(
    [
      { x: 36, y: 0 },
      { x: 36, y: 9 },
      { x: 41, y: 11.2 },
      { x: 37.2, y: 7.4 },
    ],
    step,
    1.05,
    41,
    0.04,
  )
}

/** Smooth wheel: a quarter-circle bend with finger jitter and no sharp cut. */
export function wheelTrace(): Point[] {
  const rand = mulberry32(7)
  const points: Point[] = []
  const radius = 8
  const step = 0.22
  const arc = (Math.PI / 2) * radius
  const n = Math.ceil(arc / step)
  for (let i = 0; i <= n; i++) {
    const angle = -Math.PI / 2 + (i / n) * (Math.PI / 2)
    const kick = (rand() - 0.5) * 0.16
    points.push({
      x: 18 + (radius + kick) * Math.cos(angle),
      y: 1 + radius + (radius + kick) * Math.sin(angle),
    })
  }
  points[0] = { x: 18, y: 1 }
  points[points.length - 1] = { x: 26, y: 9 }
  return points
}
