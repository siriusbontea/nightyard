import { DEFAULT_LOS, END_ZONE_DEPTH, FIELD_LENGTH } from './fieldMarks'
import type { Point, Shape, Side, Stroke } from './types'

/** American football field width in yards (160 feet). */
export const FIELD_WIDTH = 160 / 3

export const PLAYER_R = 1.62

/** How far a mark reaches upfield from its center. Diamonds are a little taller. */
export function markerReach(shape: Shape): number {
  return shape === 'diamond' ? PLAYER_R * 1.2 : PLAYER_R
}

/**
 * A mark whose body crosses the line of scrimmage sits just on its own side.
 * Someone already clear of the line, or dragged well past it, stays where they are.
 */
export function plantedMarker(player: { x: number; y: number; side: Side; shape: Shape }): Point {
  const reach = markerReach(player.shape)
  if (player.side === 'defense') {
    if (player.y < reach && player.y > -reach - 0.2) return { x: player.x, y: reach }
    return { x: player.x, y: player.y }
  }
  if (player.y > -reach && player.y < reach + 0.2) return { x: player.x, y: -reach }
  return { x: player.x, y: player.y }
}

type Alignable = { id: string; x: number; y: number; side: Side; shape: Shape }

/** Start a line on the drawn mark when it was saved on the raw spot. */
export function displayStroke(stroke: Stroke, players: readonly Alignable[]): Stroke {
  if (stroke.preset === 'man' && stroke.coverId) {
    const owner = players.find((item) => item.id === stroke.playerId)
    const target = players.find((item) => item.id === stroke.coverId)
    if (owner && target) {
      return { ...stroke, points: [plantedMarker(owner), plantedMarker(target)], curves: [null] }
    }
  }
  const owner = players.find((item) => item.id === stroke.playerId)
  if (!owner || stroke.points.length === 0) return stroke
  const start = stroke.points[0]
  if (Math.hypot(start.x - owner.x, start.y - owner.y) > 0.35) return stroke
  const planted = plantedMarker(owner)
  const dx = planted.x - owner.x
  const dy = planted.y - owner.y
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return stroke
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    curves: stroke.curves.map((curve) => (curve ? { x: curve.x + dx, y: curve.y + dy } : null)),
  }
}

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

/**
 * Match the on-screen box exactly, in yards, so the SVG viewBox has the same
 * aspect as the frame. A capped depth letterboxes a tall phone and leaves
 * blank green bands. The window stays on marked field (end zones included)
 * whenever that field is taller than the screen.
 */
export function cameraForBox(widthPx: number, heightPx: number, los = DEFAULT_LOS): Camera {
  const scale = 10
  if (widthPx < 40 || heightPx < 40) return { ahead: 30, behind: 16, scale }
  const depth = (FIELD_WIDTH * heightPx) / widthPx
  const top = los + END_ZONE_DEPTH
  const bottom = los - FIELD_LENGTH - END_ZONE_DEPTH
  const marked = top - bottom
  let ahead: number
  let behind: number
  if (depth >= marked) {
    const extra = depth - marked
    ahead = top + extra / 2
    behind = -bottom + extra / 2
  } else {
    // Keep the line in the lower-middle of the frame: formation behind it,
    // routes ahead of it, and the whole window still on marked ground.
    behind = Math.min(36, Math.max(10, depth * 0.38))
    if (behind > depth - 12) behind = Math.max(8, depth - 12)
    ahead = depth - behind
    if (ahead > top) {
      ahead = top
      behind = depth - ahead
    }
    if (-behind < bottom) {
      behind = -bottom
      ahead = depth - behind
    }
  }
  return { ahead, behind, scale }
}

/**
 * Freehand tolerances in CSS pixels. Convert with `pixelsToYards` so a phone
 * and a desktop keep the same finger gesture.
 */
export const DRAW_PIXELS = {
  sample: 2.5,
  epsilon: 6,
  cornerWindow: 18,
  cornerDegrees: 34,
  minLeg: 8,
  maxPoints: 12,
} as const

/** Yards covered by `pixels` across a field drawn `fieldPx` CSS pixels wide. */
export function pixelsToYards(pixels: number, fieldPx: number): number {
  if (!(fieldPx > 40)) return pixels / 8
  return (pixels * FIELD_WIDTH) / fieldPx
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

export interface SimplifyOptions {
  /** Heading is compared across this many yards, not one sample. */
  cornerWindow?: number
  cornerDegrees?: number
  /** Ignore a twitch whose shorter side is under this many yards. */
  minLeg?: number
  maxPoints?: number
}

function heading(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x)
}

function angleDelta(a: number, b: number): number {
  let delta = Math.abs(b - a) % (Math.PI * 2)
  if (delta > Math.PI) delta = Math.PI * 2 - delta
  return (delta * 180) / Math.PI
}

function walkIndex(points: Point[], index: number, distance: number, dir: -1 | 1): number {
  let walked = 0
  let cursor = index
  while (cursor + dir >= 0 && cursor + dir < points.length && walked < distance) {
    const next = cursor + dir
    walked += dist(points[cursor], points[next])
    cursor = next
  }
  return cursor
}

function dedupePoints(points: Point[], min: number): Point[] {
  if (points.length === 0) return []
  const out: Point[] = [{ ...points[0] }]
  for (let i = 1; i < points.length; i++) {
    if (dist(out[out.length - 1], points[i]) >= min) out.push({ ...points[i] })
    else if (i === points.length - 1) out[out.length - 1] = { ...points[i] }
  }
  return out
}

/** Turn across `window` yards. A rounded cut still counts; one jitter sample does not. */
function windowTurn(points: Point[], index: number, window: number, minLeg: number): number {
  const prev = walkIndex(points, index, window, -1)
  const next = walkIndex(points, index, window, 1)
  if (prev === index || next === index) return 0
  if (dist(points[prev], points[index]) < minLeg || dist(points[index], points[next]) < minLeg) return 0
  return angleDelta(heading(points[prev], points[index]), heading(points[index], points[next]))
}

function pickCorners(points: Point[], window: number, degrees: number, minLeg: number, maxCorners: number): number[] {
  const score = points.map((_, index) => windowTurn(points, index, window, minLeg))
  const peaks: { index: number; turn: number }[] = []
  for (let i = 1; i < points.length - 1; i++) {
    if (score[i] < degrees) continue
    const from = walkIndex(points, i, window * 0.55, -1)
    const to = walkIndex(points, i, window * 0.55, 1)
    let best = i
    for (let j = from; j <= to; j++) if (score[j] > score[best]) best = j
    if (best === i) peaks.push({ index: i, turn: score[i] })
  }
  const ranked = [...peaks].sort((a, b) => b.turn - a.turn).slice(0, maxCorners)
  ranked.sort((a, b) => a.index - b.index)
  return ranked.map((peak) => peak.index)
}

function quadraticControl(start: Point, through: Point, end: Point, t: number): Point {
  const o = 1 - t
  const denom = 2 * o * t
  if (denom < 1e-4) return { ...through }
  return {
    x: (through.x - o * o * start.x - t * t * end.x) / denom,
    y: (through.y - o * o * start.y - t * t * end.y) / denom,
  }
}

function maxCurveError(points: Point[], a: number, b: number, control: Point): number {
  let max = 0
  const span = Math.max(1, b - a)
  for (let i = a; i <= b; i++) {
    const hint = (i - a) / span
    const from = Math.max(0, hint - 0.3)
    const to = Math.min(1, hint + 0.3)
    let best = Infinity
    for (let step = 0; step <= 10; step++) {
      const t = from + ((to - from) * step) / 10
      best = Math.min(best, dist(points[i], segmentPoint(points[a], points[b], control, t)))
    }
    if (best > max) max = best
  }
  return max
}

function fitSpan(points: Point[], a: number, b: number, epsilon: number): { points: Point[]; curves: (Point | null)[] } {
  const start = points[a]
  const end = points[b]
  const straight = (): { points: Point[]; curves: (Point | null)[] } => ({
    points: [{ ...start }, { ...end }],
    curves: [null],
  })
  if (b <= a + 1) return straight()
  let max = 0
  let far = a
  for (let i = a + 1; i < b; i++) {
    const deviation = pointLineDistance(points[i], start, end)
    if (deviation > max) {
      max = deviation
      far = i
    }
  }
  if (max <= epsilon || far <= a || far >= b) return straight()
  const t = clamp((far - a) / (b - a), 0.18, 0.82)
  const control = quadraticControl(start, points[far], end, t)
  if (maxCurveError(points, a, b, control) <= epsilon * 1.7) {
    return { points: [{ ...start }, { ...end }], curves: [control] }
  }
  const left = fitSpan(points, a, far, epsilon)
  const right = fitSpan(points, far, b, epsilon)
  return {
    points: [...left.points, ...right.points.slice(1)],
    curves: [...left.curves, ...right.curves],
  }
}

function fitAnchors(points: Point[], anchors: number[], epsilon: number): { points: Point[]; curves: (Point | null)[] } {
  const fitted: Point[] = []
  const curves: (Point | null)[] = []
  for (let k = 0; k < anchors.length - 1; k++) {
    const span = fitSpan(points, anchors[k], anchors[k + 1], epsilon)
    if (k === 0) fitted.push(...span.points)
    else fitted.push(...span.points.slice(1))
    curves.push(...span.curves)
  }
  return { points: fitted, curves }
}

/**
 * Collapse a freehand stroke. Cuts are detected from the heading change over
 * a short distance, so a rounded finger break stays a corner. A gentle arc
 * becomes one or two quadratics. `epsilon` is the jitter tolerance in yards.
 */
export function simplifyPath(
  raw: Point[],
  epsilon: number,
  options?: SimplifyOptions,
): { points: Point[]; curves: (Point | null)[] } {
  if (raw.length === 0) return { points: [], curves: [] }
  if (raw.length === 1) return { points: [{ ...raw[0] }], curves: [] }
  const points = dedupePoints(raw, Math.min(0.06, epsilon * 0.2))
  if (points.length < 2) return { points, curves: [] }
  if (points.length === 2) return { points, curves: [null] }

  const window = options?.cornerWindow ?? Math.max(1.5, epsilon * 3)
  const degrees = options?.cornerDegrees ?? 36
  const minLeg = options?.minLeg ?? Math.max(0.35, epsilon)
  const maxPoints = options?.maxPoints ?? 12
  const corners = pickCorners(points, window, degrees, minLeg, Math.max(1, maxPoints - 2))
  const anchors = [0, ...corners, points.length - 1]
  let epsilonNow = epsilon
  let fitted = fitAnchors(points, anchors, epsilonNow)
  while (fitted.points.length > maxPoints && epsilonNow < epsilon * 6) {
    epsilonNow *= 1.4
    fitted = fitAnchors(points, anchors, epsilonNow)
  }
  return fitted
}

export function moveStrokePoint(stroke: Stroke, index: number, point: Point): Stroke {
  return {
    ...stroke,
    preset: null,
    points: stroke.points.map((current, i) => (i === index ? { ...point } : { ...current })),
  }
}

/** Keep a drawn point on the marked field, including both end zones. */
export function clampToField(point: Point, los: number): Point {
  const yMax = los + END_ZONE_DEPTH - 0.4
  const yMin = los - FIELD_LENGTH - END_ZONE_DEPTH + 0.4
  return {
    x: clamp(point.x, 1.2, FIELD_WIDTH - 1.23),
    y: clamp(point.y, yMin, yMax),
  }
}

/** One light pass so a finger wiggle looks tidy while it is still being drawn. */
export function smoothPreview(points: Point[]): Point[] {
  if (points.length < 4) return points.map((point) => ({ ...point }))
  const out: Point[] = [{ ...points[0] }]
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    out.push({ x: a.x * 0.7 + b.x * 0.3, y: a.y * 0.7 + b.y * 0.3 })
    out.push({ x: a.x * 0.3 + b.x * 0.7, y: a.y * 0.3 + b.y * 0.7 })
  }
  out.push({ ...points[points.length - 1] })
  return out
}

const SNAP_ANGLES = [0, 45, 90, 135, 180, -45, -90, -135, -180]

function angleDeltaDeg(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360
  return raw > 180 ? 360 - raw : raw
}

/**
 * Straight pieces within 12 degrees of level, upright, or diagonal snap to that angle.
 * A break close to a whole yard snaps to it. Curved pieces are left alone.
 */
export function tidyStroke(
  points: Point[],
  curves: (Point | null)[],
): { points: Point[]; curves: (Point | null)[] } {
  const next = points.map((point) => ({ ...point }))
  for (let i = 1; i < next.length; i++) {
    if (curves[i - 1]) continue
    const a = next[i - 1]
    const b = next[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len < 0.4) continue
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    let best = ang
    let delta = 99
    for (const target of SNAP_ANGLES) {
      const gap = angleDeltaDeg(ang, target)
      if (gap < delta) {
        delta = gap
        best = target
      }
    }
    if (delta > 12) continue
    const rad = (best * Math.PI) / 180
    let y = a.y + Math.sin(rad) * len
    const yard = Math.round(y)
    if (Math.abs(y - yard) <= 0.45) y = yard
    next[i] = { x: a.x + Math.cos(rad) * len, y }
  }
  return { points: next, curves }
}

export function setStrokeCurve(stroke: Stroke, index: number, curve: Point | null): Stroke {
  return {
    ...stroke,
    preset: null,
    curves: stroke.curves.map((current, i) => (i === index ? (curve ? { ...curve } : null) : current ? { ...current } : null)),
  }
}
