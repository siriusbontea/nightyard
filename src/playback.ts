import { dist, pointOnStroke } from './geometry'
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
  const home = { x: player.x, y: player.y }
  const time = Math.min(1, Math.max(0, t))
  if (time <= 0) return home
  const motion = motionStroke(strokes, player.id)
  const main = primaryStroke(strokes, player.id)
  if (motion && main) {
    if (time <= MOTION_SPLIT) return pointOnStroke(motion, time / MOTION_SPLIT)
    const snap = pointOnStroke(motion, 1)
    const start = main.points[0] ?? snap
    const u = (time - MOTION_SPLIT) / (1 - MOTION_SPLIT)
    if (dist(snap, start) <= 0.75) return pointOnStroke(main, u)
    const bridge = 0.12
    if (u < bridge) return lerp(snap, start, u / bridge)
    return pointOnStroke(main, (u - bridge) / (1 - bridge))
  }
  if (motion) return pointOnStroke(motion, time)
  if (main) return pointOnStroke(main, time)
  return home
}

export function positionsAt(players: Player[], strokes: Stroke[], t: number): Map<string, Point> {
  const positions = new Map<string, Point>()
  for (const player of players) positions.set(player.id, playerAtTime(player, strokes, t))
  return positions
}
