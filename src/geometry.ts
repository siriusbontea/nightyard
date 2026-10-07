import type { Point, Stroke } from './types'

/** American football field width in yards (160 feet). */
export const FIELD_WIDTH = 160 / 3

export const PLAYER_R = 1.62

export interface Camera {
  /** Yards of field shown upfield of the line of scrimmage. */
  ahead: number
  /** Yards of field shown behind the line of scrimmage. */
  behind: number
  /** SVG user units per yard. */
  scale: number
}

export const EXPORT_CAMERA: Camera = { ahead: 30, behind: 16, scale: 10 }

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** +1 when the player is on the left (or the center); inside breaks go to +x. */
export function insideDir(x: number): -1 | 1 {
  return x <= FIELD_WIDTH / 2 ? 1 : -1
}

export function fieldToSvg(point: Point, camera: Camera): Point {
  return {
    x: point.x * camera.scale,
    y: (camera.ahead - point.y) * camera.scale,
  }
}

export function viewSize(camera: Camera): { w: number; h: number } {
  return {
    w: FIELD_WIDTH * camera.scale,
    h: (camera.ahead + camera.behind) * camera.scale,
  }
}

/** Match the field's yard window to the on-screen box so players keep their size. */
export function cameraForBox(widthPx: number, heightPx: number): Camera {
  const scale = 10
  if (widthPx < 40 || heightPx < 40) return { ahead: 30, behind: 16, scale }
  const depth = clamp(FIELD_WIDTH / (widthPx / heightPx), 44, 70)
  const behind = clamp(depth * 0.34, 14, 18)
  const ahead = depth - behind
  return { ahead, behind, scale }
}

export function segmentPoint(a: Point, b: Point, curve: Point | null, t: number): Point {
  const u = clamp(t, 0, 1)
  if (!curve) {
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
  }
  const o = 1 - u
  return {
    x: o * o * a.x + 2 * o * u * curve.x + u * u * b.x,
    y: o * o * a.y + 2 * o * u * curve.y + u * u * b.y,
  }
}

export function segmentTangent(a: Point, b: Point, curve: Point | null, t: number): Point {
  const u = clamp(t, 0, 1)
  if (!curve) return { x: b.x - a.x, y: b.y - a.y }
  const o = 1 - u
  return {
    x: 2 * o * (curve.x - a.x) + 2 * u * (b.x - curve.x),
    y: 2 * o * (curve.y - a.y) + 2 * u * (b.y - curve.y),
  }
}

export function segmentLength(a: Point, b: Point, curve: Point | null): number {
  let length = 0
  let prev = a
  const steps = 16
  for (let i = 1; i <= steps; i++) {
    const next = segmentPoint(a, b, curve, i / steps)
    length += dist(prev, next)
    prev = next
  }
  return length
}

export function strokeLength(stroke: Stroke): number {
  let length = 0
  for (let i = 0; i < stroke.points.length - 1; i++) {
    length += segmentLength(stroke.points[i], stroke.points[i + 1], stroke.curves[i] ?? null)
  }
  return length
}

/** Arc-length position. t=0 is the start of the stroke, t=1 is the end. */
export function pointOnStroke(stroke: Stroke, t: number): Point {
  if (stroke.points.length === 0) return { x: 0, y: 0 }
  if (stroke.points.length === 1) return { ...stroke.points[0] }
  const targetT = clamp(t, 0, 1)
  const lengths: number[] = []
  let total = 0
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const length = segmentLength(stroke.points[i], stroke.points[i + 1], stroke.curves[i] ?? null)
    lengths.push(length)
    total += length
  }
  if (total < 1e-6) return { ...stroke.points[0] }
  let remain = targetT * total
  for (let i = 0; i < lengths.length; i++) {
    if (remain <= lengths[i] || i === lengths.length - 1) {
      const u = lengths[i] < 1e-6 ? 1 : remain / lengths[i]
      return segmentPoint(stroke.points[i], stroke.points[i + 1], stroke.curves[i] ?? null, Math.min(1, u))
    }
    remain -= lengths[i]
  }
  return { ...stroke.points[stroke.points.length - 1] }
}

export function translateStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    curves: stroke.curves.map((curve) => (curve ? { x: curve.x + dx, y: curve.y + dy } : null)),
  }
}

export function distanceToStroke(stroke: Stroke, point: Point): number {
  if (stroke.points.length < 2) return stroke.points[0] ? dist(point, stroke.points[0]) : Infinity
  let min = Infinity
  const steps = 18
  for (let i = 0; i < stroke.points.length - 1; i++) {
    for (let step = 0; step <= steps; step++) {
      const sample = segmentPoint(stroke.points[i], stroke.points[i + 1], stroke.curves[i] ?? null, step / steps)
      min = Math.min(min, dist(point, sample))
    }
  }
  return min
}

export function pointLineDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) return dist(point, a)
  return Math.abs(dx * (a.y - point.y) - dy * (a.x - point.x)) / length
}

function turnDegrees(a: Point, b: Point, c: Point): number {
  const v1x = b.x - a.x
  const v1y = b.y - a.y
  const v2x = c.x - b.x
  const v2y = c.y - b.y
  const dot = v1x * v2x + v1y * v2y
  const cross = v1x * v2y - v1y * v2x
  return Math.abs(Math.atan2(cross, dot) * (180 / Math.PI))
}

function rdpIndexes(points: Point[], start: number, end: number, epsilon: number): number[] {
  let max = 0
  let index = -1
  for (let i = start + 1; i < end; i++) {
    const distance = pointLineDistance(points[i], points[start], points[end])
    if (distance > max) {
      max = distance
      index = i
    }
  }
  if (max > epsilon && index !== -1) {
    const left = rdpIndexes(points, start, index, epsilon)
    const right = rdpIndexes(points, index, end, epsilon)
    return [...left, ...right.slice(1)]
  }
  return [start, end]
}

function maxTurnInSpan(points: Point[], start: number, end: number): number {
  let max = 0
  for (let i = start + 1; i < end; i++) {
    if (i + 1 > end) break
    max = Math.max(max, turnDegrees(points[i - 1], points[i], points[Math.min(end, i + 1)]))
  }
  return max
}

/**
 * Collapse a freehand stroke. A sharp kink in the original samples stays a
 * corner. A smooth bow becomes one quadratic, which is how a wheel gets its curve.
 */
export function simplifyPath(raw: Point[], epsilon: number): { points: Point[]; curves: (Point | null)[] } {
  if (raw.length === 0) return { points: [], curves: [] }
  if (raw.length === 1) return { points: [{ ...raw[0] }], curves: [] }
  const indexes = rdpIndexes(raw, 0, raw.length - 1, epsilon)
  if (indexes.length <= 2) {
    return {
      points: indexes.map((index) => ({ ...raw[index] })),
      curves: indexes.length === 2 ? [null] : [],
    }
  }

  const kept: number[] = [indexes[0]]
  const curves: (Point | null)[] = []
  let control: Point | null = null
  for (let k = 1; k < indexes.length - 1; k++) {
    const next = indexes[k + 1]
    const smooth = maxTurnInSpan(raw, kept[kept.length - 1], next) < 36
    if (smooth) {
      control = { ...raw[indexes[k]] }
      continue
    }
    curves.push(control)
    control = null
    kept.push(indexes[k])
  }
  curves.push(control)
  kept.push(indexes[indexes.length - 1])
  const points = kept.map((index) => ({ ...raw[index] }))
  while (curves.length < points.length - 1) curves.push(null)
  return { points, curves: curves.slice(0, points.length - 1) }
}

export function moveStrokePoint(stroke: Stroke, index: number, point: Point): Stroke {
  return {
    ...stroke,
    preset: null,
    points: stroke.points.map((current, i) => (i === index ? { ...point } : { ...current })),
  }
}

export function setStrokeCurve(stroke: Stroke, index: number, curve: Point | null): Stroke {
  return {
    ...stroke,
    preset: null,
    curves: stroke.curves.map((current, i) => (i === index ? (curve ? { ...curve } : null) : current ? { ...current } : null)),
  }
}
