import { displayStroke, dist, plantedMarker, pointOnStroke } from './geometry'
import type { Player, Point, Stroke } from './types'

/** Share of the timeline spent on pre-snap motion when a player also has a post-snap path. */
export const MOTION_SPLIT = 0.34

export function motionStroke(strokes: Stroke[], playerId: string): Stroke | undefined {
  return strokes.find((stroke) => stroke.playerId === playerId && stroke.kind === 'motion')
}

export function primaryStroke(strokes: Stroke[], playerId: string): Stroke | undefined {
  return strokes.find((stroke) => stroke.playerId === playerId && stroke.kind !== 'motion')
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/**
 * Motion finishes before the snap. A route that was drawn from the new spot
 * plays from there; a route that still starts on the alignment gets a short
 * bridge so the player does not teleport.
 */
export function playerAtTime(player: Player, strokes: Stroke[], t: number): Point {
  const home = plantedMarker(player)
  const time = Math.min(1, Math.max(0, t))
  if (time <= 0) return home
  const motion = motionStroke(strokes, player.id)
  const main = primaryStroke(strokes, player.id)
  const motionPath = motion ? displayStroke(motion, [player]) : undefined
  const mainPath = main ? displayStroke(main, [player]) : undefined
  if (motionPath && mainPath) {
    if (time <= MOTION_SPLIT) return pointOnStroke(motionPath, time / MOTION_SPLIT)
    const snap = pointOnStroke(motionPath, 1)
    const start = mainPath.points[0] ?? snap
    const u = (time - MOTION_SPLIT) / (1 - MOTION_SPLIT)
    if (dist(snap, start) <= 0.75) return pointOnStroke(mainPath, u)
    const bridge = 0.12
    if (u < bridge) return lerp(snap, start, u / bridge)
    return pointOnStroke(mainPath, (u - bridge) / (1 - bridge))
  }
  if (motionPath) return pointOnStroke(motionPath, time)
  if (mainPath) return pointOnStroke(mainPath, time)
  return home
}

export function positionsAt(players: Player[], strokes: Stroke[], t: number): Map<string, Point> {
  const positions = new Map<string, Point>()
  for (const player of players) positions.set(player.id, playerAtTime(player, strokes, t))
  return positions
}
