import { FIELD_WIDTH, insideDir } from './geometry'
import type { Player, Point, PresetId, Stroke, StrokeKind } from './types'

type BreakSide = 'left' | 'right'

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

export const SPECIAL_PRESETS: { id: PresetId; label: string; kind: StrokeKind }[] = [
  { id: 'cover', label: 'Cover lane', kind: 'run' },
  { id: 'block', label: 'Block', kind: 'block' },
  { id: 'return', label: 'Return', kind: 'run' },
  { id: 'rush-kick', label: 'Rush the kick', kind: 'run' },
  { id: 'kick', label: 'Kick', kind: 'run' },
]

export const DEFENSE_PRESETS: { id: PresetId; label: string; kind: StrokeKind; group: 'Zone' | 'Rush' | 'Cover' }[] = [
  { id: 'zone-third', label: 'Deep third', kind: 'route', group: 'Zone' },
  { id: 'zone-half', label: 'Deep half', kind: 'route', group: 'Zone' },
  { id: 'zone-flat', label: 'Flat', kind: 'route', group: 'Zone' },
  { id: 'zone-hook', label: 'Hook', kind: 'route', group: 'Zone' },
  { id: 'zone-middle', label: 'Middle', kind: 'route', group: 'Zone' },
  { id: 'man', label: 'Man', kind: 'route', group: 'Cover' },
  { id: 'spy', label: 'Spy QB', kind: 'route', group: 'Cover' },
  { id: 'contain', label: 'Contain', kind: 'block', group: 'Rush' },
  { id: 'blitz-a', label: 'A gap', kind: 'run', group: 'Rush' },
  { id: 'blitz-b', label: 'B gap', kind: 'run', group: 'Rush' },
  { id: 'blitz-edge', label: 'Edge', kind: 'run', group: 'Rush' },
]

const RUSH_FIRST: PresetId[] = ['blitz-a', 'blitz-b', 'blitz-edge', 'contain', 'spy', 'zone-hook', 'zone-flat', 'zone-middle', 'zone-third', 'zone-half', 'man']

export function isDefensePreset(preset: PresetId): boolean {
  return DEFENSE_PRESETS.some((item) => item.id === preset)
}

/** Offensive routes for offense. Defensive jobs for defense. Linemen see the rush first. Kicking plays get the four special-teams jobs. */
export function assignmentsFor(player: Player, special = false): { id: PresetId; label: string; kind: StrokeKind }[] {
  if (special) return specialJobs(player)
  if (player.side !== 'defense') return ROUTE_PRESETS
  const order = player.role === 'dl' ? RUSH_FIRST : DEFENSE_PRESETS.map((item) => item.id)
  return order.map((id) => DEFENSE_PRESETS.find((item) => item.id === id)!).filter(Boolean)
}

function specialJobs(player: Player): { id: PresetId; label: string; kind: StrokeKind }[] {
  const order: PresetId[] =
    player.label === 'K' || player.label === 'P'
      ? ['kick', 'cover']
      : player.label === 'KR' || player.label === 'KR2' || player.label === 'PR'
        ? ['return', 'block', 'cover']
        : player.role === 'dl'
          ? ['rush-kick', 'block', 'cover']
          : player.role === 'ol' || player.role === 'center'
            ? ['block', 'cover', 'rush-kick']
            : ['cover', 'return', 'block', 'rush-kick']
  return order.map((id) => SPECIAL_PRESETS.find((item) => item.id === id)!).filter(Boolean)
}

export function kindForPreset(preset: PresetId): StrokeKind {
  return (
    ROUTE_PRESETS.find((item) => item.id === preset)?.kind ??
    DEFENSE_PRESETS.find((item) => item.id === preset)?.kind ??
    SPECIAL_PRESETS.find((item) => item.id === preset)?.kind ??
    'route'
  )
}

export function presetLabel(preset: PresetId): string {
  return (
    ROUTE_PRESETS.find((item) => item.id === preset)?.label ??
    DEFENSE_PRESETS.find((item) => item.id === preset)?.label ??
    SPECIAL_PRESETS.find((item) => item.id === preset)?.label ??
    preset
  )
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
  'zone-third': 'Deep',
  'zone-half': 'Half',
  'zone-flat': 'Short',
  'zone-hook': 'Curl',
  'zone-middle': 'Center',
  man: 'Follow',
  'blitz-a': 'Rush',
  'blitz-b': 'Rush',
  'blitz-edge': 'Outside',
  spy: 'Watch',
  contain: 'Set',
  kick: 'Boot',
  cover: 'Lane',
  return: 'Back',
  'rush-kick': 'Charge',
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
      return { points: [p(0, 0), p(0, 3), p(inside * 4, 7)], curves: [null, null] }
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
    case 'kick':
      return { points: [p(0, 0), p(0, 8)], curves: [null] }
    case 'cover':
      return { points: [p(0, 0), p(0, 18)], curves: [null] }
    case 'return':
      return { points: [p(0, 0), p(inside * 5, 8), p(inside * 2, 22)], curves: [null, null] }
    case 'rush-kick':
      return { points: [p(0, 0), p(inside * 1.5, 7)], curves: [null] }
    default:
      return { points: [p(0, 0), p(inside * 3, 4)], curves: [null] }
  }
}

/** Straight routes, the middle zone, spy, and man do not break left or right. */
export function isDirectionalPreset(preset: PresetId): boolean {
  return (
    preset !== 'go' &&
    preset !== 'hitch' &&
    preset !== 'block' &&
    preset !== 'zone-middle' &&
    preset !== 'spy' &&
    preset !== 'man' &&
    preset !== 'kick' &&
    preset !== 'cover' &&
    preset !== 'rush-kick'
  )
}

export function isZonePreset(preset: PresetId | null | undefined): boolean {
  return preset === 'zone-third' || preset === 'zone-half' || preset === 'zone-flat' || preset === 'zone-hook' || preset === 'zone-middle'
}

/** How big the zone oval is, in yards. Spy is a small circle. */
export function zoneRadius(preset: PresetId | null | undefined): { rx: number; ry: number } | null {
  if (preset === 'zone-half') return { rx: 6.2, ry: 3.1 }
  if (preset === 'zone-third') return { rx: 4.4, ry: 2.8 }
  if (preset === 'zone-middle') return { rx: 3.6, ry: 2.3 }
  if (preset === 'zone-flat') return { rx: 3.2, ry: 1.9 }
  if (preset === 'zone-hook') return { rx: 2.7, ry: 1.8 }
  if (preset === 'spy') return { rx: 1.35, ry: 1.35 }
  return null
}

export function defenseLandmark(preset: PresetId, player: Player, side: BreakSide, ballX: number): Point {
  const right = side === 'right'
  const width = FIELD_WIDTH
  const shift = right ? 1 : -1
  const clampX = (x: number) => Math.min(width - 1.8, Math.max(1.8, x))
  if (preset === 'zone-third') {
    if (Math.abs(player.x - ballX) < 8) return { x: ballX, y: 16 }
    return { x: right ? width * 0.8 : width * 0.2, y: 16 }
  }
  if (preset === 'zone-half') return { x: right ? width * 0.74 : width * 0.26, y: 16 }
  if (preset === 'zone-flat') return { x: right ? width - 3.2 : 3.2, y: 2 }
  if (preset === 'zone-hook') return { x: clampX(player.x + (ballX >= player.x ? 1.2 : -1.2)), y: 11 }
  if (preset === 'zone-middle') return { x: ballX, y: 9 }
  if (preset === 'blitz-a') return { x: ballX + shift * 1.7, y: -2.5 }
  if (preset === 'blitz-b') return { x: ballX + shift * 4.3, y: -2.3 }
  if (preset === 'blitz-edge') return { x: clampX(ballX + shift * 11), y: -1.4 }
  if (preset === 'spy') return { x: ballX, y: -3.5 }
  if (preset === 'contain') return { x: right ? Math.min(width - 1.8, ballX + 10) : Math.max(1.8, ballX - 10), y: -0.2 }
  if (preset === 'rush-kick') return { x: ballX, y: player.y > 0.8 ? player.y - 8 : player.y + 7 }
  return { x: player.x + shift * 4, y: player.y + 4 }
}

export function presetFromPlayer(
  preset: PresetId,
  player: Player,
  origin?: Point,
  inside?: -1 | 1,
  ballX = FIELD_WIDTH / 2,
): { points: Point[]; curves: (Point | null)[] } {
  const start = origin ?? { x: player.x, y: player.y }
  if ((isDefensePreset(preset) && preset !== 'man') || preset === 'rush-kick') {
    const side: BreakSide = inside === undefined ? (player.x <= ballX ? 'left' : 'right') : inside === 1 ? 'right' : 'left'
    const end = defenseLandmark(preset, { ...player, x: start.x, y: start.y }, side, ballX)
    return { points: [start, end], curves: [null] }
  }
  if (preset === 'man') {
    const side: BreakSide = inside === 1 ? 'right' : 'left'
    const end = { x: start.x + (side === 'right' ? 5 : -5), y: start.y - 4 }
    return { points: [start, end], curves: [null] }
  }
  return presetPath(preset, start, inside ?? insideDir(player.x))
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
