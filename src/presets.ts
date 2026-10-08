import { insideDir } from './geometry'
import type { Player, Point, PresetId, Stroke, StrokeKind } from './types'

export const ROUTE_PRESETS: { id: PresetId; label: string; kind: StrokeKind }[] = [
  { id: 'go', label: 'Go', kind: 'route' },
  { id: 'slant', label: 'Slant', kind: 'route' },
  { id: 'out', label: 'Out', kind: 'route' },
  { id: 'in', label: 'In', kind: 'route' },
  { id: 'post', label: 'Post', kind: 'route' },
  { id: 'corner', label: 'Corner', kind: 'route' },
  { id: 'hitch', label: 'Hitch', kind: 'route' },
  { id: 'curl', label: 'Curl', kind: 'route' },
  { id: 'wheel', label: 'Wheel', kind: 'route' },
  { id: 'drag', label: 'Drag', kind: 'route' },
  { id: 'motion', label: 'Motion', kind: 'motion' },
  { id: 'block', label: 'Block', kind: 'block' },
  { id: 'run', label: 'Run', kind: 'run' },
]

export function kindForPreset(preset: PresetId): StrokeKind {
  return ROUTE_PRESETS.find((item) => item.id === preset)?.kind ?? 'route'
}

export function presetLabel(preset: PresetId): string {
  return ROUTE_PRESETS.find((item) => item.id === preset)?.label ?? preset
}

export function kindLabel(kind: StrokeKind): string {
  if (kind === 'motion') return 'Motion'
  if (kind === 'block') return 'Block'
  if (kind === 'run') return 'Run'
  return 'Route'
}

const PLAIN_PRESET: Record<PresetId, string> = {
  go: 'Straight',
  slant: 'Cut in',
  out: 'Cut out',
  in: 'Come in',
  post: 'Deep in',
  corner: 'Deep out',
  hitch: 'Stop',
  curl: 'Come back',
  wheel: 'Around',
  drag: 'Across',
  motion: 'Before',
  block: 'Stop them',
  run: 'Carry',
}

/** One plain word under the real route name. */
export function plainPreset(preset: PresetId): string {
  return PLAIN_PRESET[preset]
}

/**
 * Build a preset in field yards. `inside` is +1 when breaks toward +x are inside.
 * Upfield is +y.
 */
export function presetPath(preset: PresetId, origin: Point, inside: -1 | 1): { points: Point[]; curves: (Point | null)[] } {
  const p = (x: number, y: number): Point => ({ x: origin.x + x, y: origin.y + y })
  switch (preset) {
    case 'go':
      return { points: [p(0, 0), p(0, 15)], curves: [null] }
    case 'slant':
      return { points: [p(0, 0), p(0, 2.4), p(inside * 8, 10.4)], curves: [null, null] }
    case 'out':
      return { points: [p(0, 0), p(0, 8), p(-inside * 6, 8)], curves: [null, null] }
    case 'in':
      return { points: [p(0, 0), p(0, 8), p(inside * 6, 8)], curves: [null, null] }
    case 'post':
      return { points: [p(0, 0), p(0, 9), p(inside * 6.5, 16)], curves: [null, null] }
    case 'corner':
      return {
        points: [p(0, 0), p(0, 8), p(-inside * 6.5, 15)],
        curves: [null, p(-inside * 1.2, 13.5)],
      }
    case 'hitch':
      return { points: [p(0, 0), p(0, 5), p(0, 3.3)], curves: [null, null] }
    case 'curl':
      return {
        points: [p(0, 0), p(0, 9), p(inside * 1.4, 6.6)],
        curves: [null, p(-inside * 1.6, 10.4)],
      }
    case 'wheel':
      return {
        points: [p(0, 0), p(-inside * 4.5, 0.2), p(-inside * 7.2, 14)],
        curves: [null, p(-inside * 7.4, 1.5)],
      }
    case 'drag':
      return { points: [p(0, 0), p(0, 1.3), p(inside * 12, 1.6)], curves: [null, null] }
    case 'block':
      return { points: [p(0, 0), p(0, 1.35)], curves: [null] }
    case 'run':
      return { points: [p(0, 0), p(inside * 1.2, 3), p(inside * 1.2, 11)], curves: [null, null] }
    case 'motion':
      return { points: [p(0, 0), p(inside * 7, 0)], curves: [null] }
  }
}

export function presetFromPlayer(preset: PresetId, player: Player, origin?: Point): { points: Point[]; curves: (Point | null)[] } {
  return presetPath(preset, origin ?? { x: player.x, y: player.y }, insideDir(player.x))
}

export function makeStroke(
  id: string,
  playerId: string,
  preset: PresetId,
  path: { points: Point[]; curves: (Point | null)[] },
): Stroke {
  return {
    id,
    playerId,
    kind: kindForPreset(preset),
    points: path.points,
    curves: path.curves,
    preset,
  }
}
