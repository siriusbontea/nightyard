import { dist, distanceToStroke } from './geometry'
import { isPlayerShown } from './play'
import type { Play, Point } from './types'

export type Hit =
  | { type: 'handle'; kind: 'point' | 'curve' | 'bend'; strokeId: string; index: number }
  | { type: 'player'; id: string }
  | { type: 'stroke'; id: string }
  | { type: 'field' }

export function hitTest(
  play: Play,
  point: Point,
  radii: { handle: number; player: number; stroke: number },
  options: { showHandles: boolean; selectedStrokeId: string | null; preferPlayers: boolean },
): Hit {
  const handle = options.showHandles ? nearestHandle(play, point, radii.handle, options.selectedStrokeId) : null
  if (handle && !options.preferPlayers) return handle
  let nearestPlayer: { id: string; distance: number } | null = null
  for (const player of play.players) {
    if (!isPlayerShown(play, player)) continue
    const distance = dist(point, player)
    if (distance <= radii.player && (!nearestPlayer || distance < nearestPlayer.distance)) {
      nearestPlayer = { id: player.id, distance }
    }
  }
  if (nearestPlayer) return { type: 'player', id: nearestPlayer.id }
  if (handle) return handle
  let nearestStroke: { id: string; distance: number } | null = null
  for (const stroke of play.strokes) {
    const owner = play.players.find((player) => player.id === stroke.playerId)
    if (!owner || !isPlayerShown(play, owner)) continue
    const distance = distanceToStroke(stroke, point)
    if (distance <= radii.stroke && (!nearestStroke || distance < nearestStroke.distance)) {
      nearestStroke = { id: stroke.id, distance }
    }
  }
  if (nearestStroke) return { type: 'stroke', id: nearestStroke.id }
  return { type: 'field' }
}

function nearestHandle(play: Play, point: Point, radius: number, strokeId: string | null): Hit | null {
  const stroke = play.strokes.find((item) => item.id === strokeId)
  if (!stroke) return null
  let bestDistance = radius
  let bestHit: Hit | null = null
  const consider = (distance: number, hit: Hit) => {
    if (distance <= bestDistance) {
      bestDistance = distance
      bestHit = hit
    }
  }
  for (let i = 1; i < stroke.points.length; i++) {
    consider(dist(point, stroke.points[i]), { type: 'handle', kind: 'point', strokeId: stroke.id, index: i })
  }
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const curve = stroke.curves[i]
    if (curve) {
      consider(dist(point, curve), { type: 'handle', kind: 'curve', strokeId: stroke.id, index: i })
    } else {
      const mid = {
        x: (stroke.points[i].x + stroke.points[i + 1].x) / 2,
        y: (stroke.points[i].y + stroke.points[i + 1].y) / 2,
      }
      consider(dist(point, mid), { type: 'handle', kind: 'bend', strokeId: stroke.id, index: i })
    }
  }
  return bestHit
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
