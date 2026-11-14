import { displayStroke, dist, distanceToStroke, markerReach, plantedMarker, segmentLength } from './geometry'
import { isPlayerShown } from './play'
import type { Play, Point } from './types'

/** Invisible tap size for a player mark. The drawn mark stays smaller. */
export const PLAYER_HIT_PX = 44

export function playerHitYards(yardsForPx: (px: number) => number): number {
  return Math.max(1.55, yardsForPx(PLAYER_HIT_PX))
}

export type Hit =
  | { type: 'handle'; kind: 'point' | 'curve' | 'bend'; strokeId: string; index: number }
  | { type: 'player'; id: string }
  | { type: 'stroke'; id: string }
  | { type: 'field' }

export function hitTest(
  play: Play,
  point: Point,
  radii: { handle: number; player: number; stroke: number; marker?: number; cornerBias?: number; minBend?: number },
  options: { showHandles: boolean; selectedStrokeId: string | null; preferPlayers: boolean },
): Hit {
  let nearestPlayer: { id: string; distance: number } | null = null
  let onMarker: { id: string; distance: number } | null = null
  for (const player of play.players) {
    if (!isPlayerShown(play, player)) continue
    const distance = dist(point, plantedMarker(player))
    const body = radii.marker ?? markerReach(player.shape)
    if (distance <= body && (!onMarker || distance < onMarker.distance)) onMarker = { id: player.id, distance }
    if (distance <= radii.player && (!nearestPlayer || distance < nearestPlayer.distance)) {
      nearestPlayer = { id: player.id, distance }
    }
  }
  // A finger on the marker itself is always that player, even if a route handle is closer.
  if (onMarker) return { type: 'player', id: onMarker.id }
  const handle = options.showHandles
    ? nearestHandle(play, point, radii.handle, options.selectedStrokeId, radii.cornerBias ?? 0, radii.minBend ?? 0)
    : null
  if (handle && !options.preferPlayers) return handle
  if (nearestPlayer) return { type: 'player', id: nearestPlayer.id }
  if (handle) return handle
  let nearestStroke: { id: string; distance: number } | null = null
  for (const stroke of play.strokes) {
    const owner = play.players.find((player) => player.id === stroke.playerId)
    if (!owner || !isPlayerShown(play, owner)) continue
    const distance = distanceToStroke(displayStroke(stroke, play.players), point)
    if (distance <= radii.stroke && (!nearestStroke || distance < nearestStroke.distance)) {
      nearestStroke = { id: stroke.id, distance }
    }
  }
  if (nearestStroke) return { type: 'stroke', id: nearestStroke.id }
  return { type: 'field' }
}

function nearestHandle(
  play: Play,
  point: Point,
  radius: number,
  strokeId: string | null,
  cornerBias: number,
  minBend: number,
): Hit | null {
  const stored = play.strokes.find((item) => item.id === strokeId)
  if (!stored) return null
  const stroke = displayStroke(stored, play.players)
  const best: { point: { distance: number; hit: Hit } | null; bend: { distance: number; hit: Hit } | null } = {
    point: null,
    bend: null,
  }
  const keep = (slot: 'point' | 'bend', distance: number, hit: Hit) => {
    if (distance > radius) return
    const current = best[slot]
    if (!current || distance < current.distance) best[slot] = { distance, hit }
  }
  for (let i = 1; i < stroke.points.length; i++) {
    keep('point', dist(point, stroke.points[i]), { type: 'handle', kind: 'point', strokeId: stroke.id, index: i })
  }
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const a = stroke.points[i]
    const b = stroke.points[i + 1]
    const curve = stroke.curves[i] ?? null
    if (minBend > 0 && segmentLength(a, b, curve) < minBend) continue
    const at = curve ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    keep('bend', dist(point, at), {
      type: 'handle',
      kind: curve ? 'curve' : 'bend',
      strokeId: stroke.id,
      index: i,
    })
  }
  if (best.point && cornerBias > 0 && best.point.distance <= cornerBias) return best.point.hit
  if (best.point && best.bend) return best.point.distance <= best.bend.distance ? best.point.hit : best.bend.hit
  return best.point?.hit ?? best.bend?.hit ?? null
}

export function clientToField(svg: SVGSVGElement, clientX: number, clientY: number, camera: { ahead: number; scale: number }): Point {
  const point = svg.createSVGPoint()
  point.x = clientX
  point.y = clientY
  const matrix = svg.getScreenCTM()
  if (!matrix) return { x: 0, y: 0 }
  const local = point.matrixTransform(matrix.inverse())
  return { x: local.x / camera.scale, y: camera.ahead - local.y / camera.scale }
}
