import { ballMarkup } from '../ball'
import { fieldToSvg, markerReach, segmentTangent, type Camera } from '../geometry'
import { ballXOf, presetOrigin } from '../play'
import { kindForPreset, presetFromPlayer, zoneRadius } from '../presets'
import { NIGHT } from '../theme'
import type { Play, Player, Point, PresetId } from '../types'
import type { BreakSide } from '../play'

const AHEAD = 18
const BEHIND = 8
const HALF = 14
const SCALE = 4
const CAMERA: Camera = { ahead: AHEAD, behind: BEHIND, scale: SCALE }

/** Tiny field for one path. Upfield is up, same as the real field. */
export function PathPreview(props: { play: Play; player: Player; preset: PresetId; side?: BreakSide }) {
  const inside = props.side === 'left' ? -1 : props.side === 'right' ? 1 : undefined
  const path = presetFromPlayer(
    props.preset,
    props.player,
    presetOrigin(props.play, props.player.id, props.preset),
    inside,
    ballXOf(props.play),
    props.play.format,
  )
  const origin = path.points[0]
  const drop = props.player.side === 'defense' ? markerReach(props.player.shape) : -markerReach(props.player.shape)
  const shift = (point: Point): Point => ({ x: point.x - origin.x + HALF, y: point.y - origin.y + drop })
  const points = path.points.map(shift)
  const curves = path.curves.map((curve) => (curve ? shift(curve) : null))
  const width = HALF * 2 * SCALE
  const height = (AHEAD + BEHIND) * SCALE
  const kind = kindForPreset(props.preset)
  const zone = zoneRadius(props.preset)
  const man = props.preset === 'man'
  const color = props.player.routeColor
  const outline = NIGHT.routeOutline
  let d = ''
  points.forEach((point, index) => {
    const at = fieldToSvg(point, CAMERA)
    if (index === 0) {
      d = `M${at.x.toFixed(1)} ${at.y.toFixed(1)}`
      return
    }
    const curve = curves[index - 1]
    if (curve) {
      const control = fieldToSvg(curve, CAMERA)
      d += ` Q${control.x.toFixed(1)} ${control.y.toFixed(1)} ${at.x.toFixed(1)} ${at.y.toFixed(1)}`
    } else {
      d += ` L${at.x.toFixed(1)} ${at.y.toFixed(1)}`
    }
  })
  const end = fieldToSvg(points[points.length - 1], CAMERA)
  const rawDir = segmentTangent(points[points.length - 2], points[points.length - 1], curves[curves.length - 1] ?? null, 1)
  const dir = { x: rawDir.x, y: -rawDir.y }
  const playerAt = fieldToSvg(shift(origin), CAMERA)
  const ballAt = fieldToSvg({ x: HALF, y: -0.85 }, CAMERA)
  const losY = AHEAD * SCALE
  const dash = kind === 'motion' ? '5 3.4' : undefined
  return (
    <svg class="path-preview" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <rect width={width} height={height} fill={NIGHT.turf[0]} />
      <line x1="0" y1={losY} x2={width} y2={losY} stroke={NIGHT.los} stroke-width="2" />
      <path d={d} fill="none" stroke={outline} stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray={man ? '7 6' : dash} />
      <path d={d} fill="none" stroke={color} stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray={man ? '7 6' : dash} />
      {zone ? (
        <ellipse cx={end.x} cy={end.y} rx={zone.rx * SCALE * 0.72} ry={zone.ry * SCALE * 0.72} fill={color} fill-opacity="0.25" stroke={color} stroke-width="2" />
      ) : man ? null : kind === 'block' || props.preset === 'contain' ? (
        <BlockCap tip={end} dir={dir} color={color} outline={outline} />
      ) : (
        <Arrow tip={end} dir={dir} color={color} outline={outline} />
      )}
      <circle cx={playerAt.x} cy={playerAt.y} r="4.5" fill={props.player.color} stroke="#07140e" stroke-width="1.4" />
      <g dangerouslySetInnerHTML={{ __html: ballMarkup(ballAt.x, ballAt.y, 8, NIGHT.ballFill, NIGHT.ballStroke) }} />
    </svg>
  )
}

function Arrow(props: { tip: Point; dir: Point; color: string; outline: string }) {
  return (
    <g>
      <path d={arrow(props.tip, props.dir, 9)} fill={props.outline} />
      <path d={arrow(props.tip, props.dir, 6.5)} fill={props.color} />
    </g>
  )
}

function BlockCap(props: { tip: Point; dir: Point; color: string; outline: string }) {
  const len = Math.hypot(props.dir.x, props.dir.y) || 1
  const px = -props.dir.y / len
  const py = props.dir.x / len
  const x1 = props.tip.x + px * 7
  const y1 = props.tip.y + py * 7
  const x2 = props.tip.x - px * 7
  const y2 = props.tip.y - py * 7
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={props.outline} stroke-width="6" stroke-linecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={props.color} stroke-width="3.2" stroke-linecap="round" />
    </g>
  )
}

function arrow(tip: Point, dir: Point, size: number): string {
  const len = Math.hypot(dir.x, dir.y) || 1
  const ux = dir.x / len
  const uy = dir.y / len
  const px = -uy
  const py = ux
  const base = { x: tip.x - ux * size, y: tip.y - uy * size }
  const left = { x: base.x + px * size * 0.46, y: base.y + py * size * 0.46 }
  const right = { x: base.x - px * size * 0.46, y: base.y - py * size * 0.46 }
  return `M${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L${left.x.toFixed(1)} ${left.y.toFixed(1)} L${right.x.toFixed(1)} ${right.y.toFixed(1)} Z`
}
