import { END_ZONE_DEPTH, FIELD_LENGTH, HASH_INSET, displayedYard, fieldYAt, numberArrow } from './fieldMarks'
import { FIELD_WIDTH, PLAYER_R, fieldToSvg, segmentTangent, viewSize, type Camera } from './geometry'
import { isPlayerShown } from './play'
import type { Theme } from './theme'
import { ourSideOf, type Play, type Player, type Point, type Stroke } from './types'

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeColor(color: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#94a3b8'
}

function pathD(stroke: Stroke, camera: Camera): string {
  const points = stroke.points.map((point) => fieldToSvg(point, camera))
  let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 1; i < points.length; i++) {
    const curve = stroke.curves[i - 1]
    const to = points[i]
    if (curve) {
      const control = fieldToSvg(curve, camera)
      d += ` Q${control.x.toFixed(2)} ${control.y.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
    } else {
      d += ` L${to.x.toFixed(2)} ${to.y.toFixed(2)}`
    }
  }
  return d
}

function arrowPath(tip: Point, dir: Point, size: number): string {
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

function routeMarkup(stroke: Stroke, play: Play, camera: Camera, theme: Theme, selected: boolean): string {
  if (stroke.points.length < 2) return ''
  const player = play.players.find((item) => item.id === stroke.playerId)
  const color = theme.outlineOnly ? '#111111' : safeColor(player?.routeColor || player?.color || '#38bdf8')
  const outline = theme.outlineOnly ? '#ffffff' : theme.routeOutline
  const inner = (stroke.kind === 'run' ? 0.62 : 0.5) * camera.scale
  const outer = inner + 0.28 * camera.scale
  const d = pathD(stroke, camera)
  const dash = stroke.kind === 'motion' ? ` stroke-dasharray="${(0.95 * camera.scale).toFixed(1)} ${(0.68 * camera.scale).toFixed(1)}"` : ''
  const end = stroke.points[stroke.points.length - 1]
  const prev = stroke.points[stroke.points.length - 2]
  const fieldDir = segmentTangent(prev, end, stroke.curves[stroke.curves.length - 1] ?? null, 1)
  const dir = { x: fieldDir.x, y: -fieldDir.y }
  const tip = fieldToSvg(end, camera)
  let cap = ''
  if (stroke.kind === 'block') {
    const len = Math.hypot(dir.x, dir.y) || 1
    const px = -dir.y / len
    const py = dir.x / len
    const half = 1.25 * camera.scale
    const x1 = tip.x + px * half
    const y1 = tip.y + py * half
    const x2 = tip.x - px * half
    const y2 = tip.y - py * half
    cap = `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${outline}" stroke-width="${(outer + 1).toFixed(1)}" stroke-linecap="round"/>
      <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${inner.toFixed(1)}" stroke-linecap="round"/>`
  } else {
    const size = 1.85 * camera.scale
    cap = `<path d="${arrowPath(tip, dir, size + 2.2)}" fill="${outline}"/><path d="${arrowPath(tip, dir, size)}" fill="${color}"/>`
  }
  const emphasis = selected ? 1.15 : 1
  return `<g data-stroke-id="${stroke.id}">
    <path d="${d}" fill="none" stroke="${outline}" stroke-width="${(outer * emphasis).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${dash}/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${(inner * emphasis).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${dash}/>
    ${cap}
  </g>`
}

function handlesMarkup(stroke: Stroke, camera: Camera): string {
  const parts: string[] = []
  for (let i = 1; i < stroke.points.length; i++) {
    const point = fieldToSvg(stroke.points[i], camera)
    parts.push(
      `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="7.5" fill="#ffffff" stroke="#2ee6c8" stroke-width="2.4"/>`,
    )
  }
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const curve = stroke.curves[i]
    if (curve) {
      const point = fieldToSvg(curve, camera)
      parts.push(
        `<rect x="${(point.x - 5.5).toFixed(1)}" y="${(point.y - 5.5).toFixed(1)}" width="11" height="11" fill="#2ee6c8" stroke="#062018" stroke-width="1.4" transform="rotate(45 ${point.x.toFixed(1)} ${point.y.toFixed(1)})"/>`,
      )
    } else {
      const a = stroke.points[i]
      const b = stroke.points[i + 1]
      const mid = fieldToSvg({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, camera)
      parts.push(
        `<circle cx="${mid.x.toFixed(1)}" cy="${mid.y.toFixed(1)}" r="5.5" fill="none" stroke="#2ee6c8" stroke-width="2"/>`,
      )
    }
  }
  return parts.join('')
}

/** Dark ink on light markers, light ink on dark ones. Print sheets are white fills. */
export function labelInk(fill: string): string {
  return relativeLuminance(fill) >= 0.28 ? '#102033' : '#f8fafc'
}

function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw.slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 1
  const channel = (pair: string) => {
    const value = parseInt(pair, 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const r = channel(full.slice(0, 2))
  const g = channel(full.slice(2, 4))
  const b = channel(full.slice(4, 6))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Font size in SVG units so 1–4 character labels stay inside the marker. */
export function labelFontSize(label: string, radius: number, shape: Player['shape']): number {
  const chars = Math.min(4, Math.max(1, [...label].length))
  const widthRatio = shape === 'diamond' ? 0.7 : shape === 'square' ? 0.78 : 0.68
  const em = chars === 1 ? 0.7 : 0.58
  const fromWidth = (radius * 2 * widthRatio) / (chars * em)
  const fromHeight = radius * (shape === 'diamond' ? 0.98 : chars === 1 ? 1.18 : 0.98)
  return Math.min(fromWidth, fromHeight)
}

function playerMarkup(player: Player, play: Play, camera: Camera, theme: Theme, selected: boolean): string {
  const pos = fieldToSvg(player, camera)
  const radius = PLAYER_R * camera.scale
  const fill = theme.outlineOnly ? '#ffffff' : safeColor(player.color)
  const stroke = theme.outlineOnly ? '#161616' : '#0c1220'
  const sw = theme.outlineOnly ? 2.6 : 1.7
  let shape = ''
  if (player.shape === 'circle') {
    shape = `<circle r="${radius.toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
  } else if (player.shape === 'square') {
    shape = `<rect x="${-radius}" y="${-radius}" width="${radius * 2}" height="${radius * 2}" rx="${player.role === 'center' ? 3 : 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
  } else {
    const dy = radius * 1.2
    const dx = radius * 0.92
    shape = `<polygon points="0,${-dy.toFixed(2)} ${dx.toFixed(2)},0 0,${(dy * 0.92).toFixed(2)} ${(-dx).toFixed(2)},0" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
  }
  const ring = selected && theme.interactive ? `<circle r="${(radius + 5).toFixed(1)}" fill="none" stroke="#2ee6c8" stroke-width="2.5"/>` : ''
  const size = labelFontSize(player.label, radius, player.shape)
  const label = `<text x="0" y="0" fill="${labelInk(fill)}" font-family="Oswald, Impact, sans-serif" font-size="${size.toFixed(1)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${escapeXml(player.label)}</text>`
  let badge = ''
  if (player.read && player.side === ourSideOf(play)) {
    const bx = radius * 0.82
    const by = -radius * 0.82
    badge = `<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><circle r="9.5" fill="${theme.badgeFill}" stroke="${theme.badgeStroke}" stroke-width="1.6"/><text fill="${theme.badgeText}" font-family="Oswald, Impact, sans-serif" font-size="12" font-weight="600" text-anchor="middle" dominant-baseline="central">${player.read}</text></g>`
  }
  return `<g data-player-id="${escapeXml(player.id)}" transform="translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})">${ring}${shape}${label}${badge}</g>`
}

function yardArrow(x: number, y: number, dir: 'up' | 'down', scale: number): string {
  const height = 0.9 * scale
  const half = 0.42 * scale
  const tip = dir === 'up' ? y - height : y + height
  const base = y
  return `M${x.toFixed(1)} ${tip.toFixed(1)} L${(x - half).toFixed(1)} ${base.toFixed(1)} L${(x + half).toFixed(1)} ${base.toFixed(1)} Z`
}

/** Sideways 10-yard numbers, counting up to midfield and back down, with a goal arrow. */
function yardNumbers(los: number, scale: number, ahead: number, height: number, theme: Theme): string {
  const parts: string[] = []
  const size = 2.8 * scale
  const left = 9 * scale
  const right = (FIELD_WIDTH - 9) * scale
  const attrs = `fill="${theme.number}" stroke="${theme.numberStroke}" stroke-width="${(scale * 0.18).toFixed(2)}" paint-order="stroke" font-family="Oswald, Impact, sans-serif" font-size="${size.toFixed(1)}" font-weight="500" text-anchor="middle" dominant-baseline="central"`
  for (let yard = 10; yard <= 90; yard += 10) {
    const y = (ahead - fieldYAt(los, yard)) * scale
    if (y < size || y > height - size) continue
    const label = displayedYard(yard)
    const arrow = numberArrow(yard)
    parts.push(`<text ${attrs} transform="rotate(-90 ${left.toFixed(1)} ${y.toFixed(1)})">${label}</text>`)
    parts.push(`<text ${attrs} transform="rotate(90 ${right.toFixed(1)} ${y.toFixed(1)})">${label}</text>`)
    if (!arrow) continue
    const shift = (arrow === 'up' ? -2.35 : 2.35) * scale
    const inset = 2.5 * scale
    parts.push(`<path data-arrow="${arrow}" d="${yardArrow(left + inset, y + shift, arrow, scale)}" fill="${theme.number}"/>`)
    parts.push(`<path data-arrow="${arrow}" d="${yardArrow(right - inset, y + shift, arrow, scale)}" fill="${theme.number}"/>`)
  }
  return parts.join('')
}

export function fieldMarkup(options: {
  play: Play
  camera: Camera
  theme: Theme
  selectedPlayerId?: string | null
  selectedStrokeId?: string | null
  showHandles?: boolean
}): string {
  const { play, camera, theme } = options
  const { w, h } = viewSize(camera)
  const { scale, ahead } = camera
  const parts: string[] = []
  const svgY = (fieldY: number) => (ahead - fieldY) * scale
  const seen = (y: number, pad = 0) => y >= -pad && y <= h + pad
  parts.push(`<defs>
    <filter id="grain-${theme.id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <filter id="glow-${theme.id}" x="-20%" y="-800%" width="140%" height="1700%">
      <feGaussianBlur stdDeviation="2.4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="vig-${theme.id}" cx="50%" cy="40%" r="75%">
      <stop offset="55%" stop-color="${theme.vignette ?? '#000'}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${theme.vignette ?? '#000'}" stop-opacity="0.55"/>
    </radialGradient>
    <clipPath id="clip-${theme.id}"><rect width="${w}" height="${h}"/></clipPath>
  </defs>`)
  parts.push(`<g clip-path="url(#clip-${theme.id})">`)
  parts.push(`<rect width="${w}" height="${h}" fill="${theme.turf[0]}"/>`)
  const stripe = 5 * scale
  for (let yard = 0; yard < FIELD_LENGTH; yard += 5) {
    if (Math.floor(yard / 5) % 2 === 0) continue
    const y = svgY(fieldYAt(play.los, yard))
    if (y > h || y + stripe < 0) continue
    parts.push(`<rect x="0" y="${y.toFixed(1)}" width="${w}" height="${stripe}" fill="${theme.turf[1]}"/>`)
  }
  for (const goal of [0, FIELD_LENGTH]) {
    const topField = goal === 0 ? fieldYAt(play.los, 0) + END_ZONE_DEPTH : fieldYAt(play.los, FIELD_LENGTH)
    const y = svgY(topField)
    const height = END_ZONE_DEPTH * scale
    if (y > h || y + height < 0) continue
    parts.push(`<rect x="0" y="${y.toFixed(1)}" width="${w}" height="${height.toFixed(1)}" fill="${theme.endZone}"/>`)
  }
  if (theme.grain) {
    parts.push(`<rect width="${w}" height="${h}" filter="url(#grain-${theme.id})" opacity="${theme.id === 'night' ? 0.16 : 0.08}"/>`)
  }
  if (theme.vignette) {
    parts.push(`<rect width="${w}" height="${h}" fill="url(#vig-${theme.id})"/>`)
  }
  for (let yard = 0; yard <= FIELD_LENGTH; yard += 5) {
    const y = svgY(fieldYAt(play.los, yard))
    if (!seen(y, 2)) continue
    const width = yard === 0 || yard === FIELD_LENGTH ? 2.6 : yard % 10 === 0 ? 1.8 : 1.15
    parts.push(`<line x1="0" y1="${y.toFixed(2)}" x2="${w}" y2="${y.toFixed(2)}" stroke="${theme.line}" stroke-width="${width}"/>`)
  }
  const hashL = HASH_INSET * scale
  const hashR = (FIELD_WIDTH - HASH_INSET) * scale
  const tick = 0.7 * scale
  for (let yard = 1; yard < FIELD_LENGTH; yard += 1) {
    if (yard % 5 === 0) continue
    const y = svgY(fieldYAt(play.los, yard))
    if (!seen(y)) continue
    const stroke = theme.lineSoft
    parts.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${tick.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${stroke}" stroke-width="1.1"/>`)
    parts.push(`<line x1="${(hashL - tick).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(hashL + tick).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${stroke}" stroke-width="1.1"/>`)
    parts.push(`<line x1="${(hashR - tick).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(hashR + tick).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${stroke}" stroke-width="1.1"/>`)
    parts.push(`<line x1="${(w - tick).toFixed(1)}" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}" stroke="${stroke}" stroke-width="1.1"/>`)
  }
  const losY = ahead * scale
  parts.push(
    `<line x1="0" y1="${losY}" x2="${w}" y2="${losY}" stroke="${theme.los}" stroke-width="3.2"${theme.losGlow ? ` filter="url(#glow-${theme.id})"` : ''}/>`,
  )
  const tagX = w - 7.6 * scale
  const tagFill = theme.outlineOnly ? '#ffffff' : '#062018'
  const tagInk = theme.outlineOnly ? '#111111' : theme.los
  parts.push(
    `<g transform="translate(${tagX.toFixed(1)} ${(losY - 46).toFixed(1)})"><rect width="42" height="18" rx="9" fill="${tagFill}" stroke="${tagInk}" stroke-width="1.4"/><text x="21" y="10" fill="${tagInk}" font-family="Oswald, Impact, sans-serif" font-size="11" text-anchor="middle" dominant-baseline="central">LINE</text></g>`,
  )
  const ball = fieldToSvg({ x: FIELD_WIDTH / 2, y: -0.85 }, camera)
  parts.push(
    `<ellipse cx="${ball.x.toFixed(1)}" cy="${ball.y.toFixed(1)}" rx="${(0.55 * scale).toFixed(1)}" ry="${(0.82 * scale).toFixed(1)}" fill="${theme.ballFill}" stroke="${theme.ballStroke}" stroke-width="1.2" transform="rotate(-28 ${ball.x.toFixed(1)} ${ball.y.toFixed(1)})"/>`,
  )
  parts.push(yardNumbers(play.los, scale, ahead, h, theme))
  const visible = (player: Player) => isPlayerShown(play, player)
  const strokes = play.strokes.filter((stroke) => {
    const owner = play.players.find((player) => player.id === stroke.playerId)
    return owner ? visible(owner) : false
  })
  for (const stroke of strokes) {
    parts.push(routeMarkup(stroke, play, camera, theme, stroke.id === options.selectedStrokeId))
  }
  const ordered = [
    ...play.players.filter((player) => player.side !== ourSideOf(play) && play.showDefense),
    ...play.players.filter((player) => player.side === ourSideOf(play)),
  ]
  for (const player of ordered) {
    parts.push(playerMarkup(player, play, camera, theme, player.id === options.selectedPlayerId))
  }
  if (options.showHandles && options.selectedStrokeId) {
    const selected = play.strokes.find((stroke) => stroke.id === options.selectedStrokeId)
    if (selected) parts.push(handlesMarkup(selected, camera))
  }
  parts.push(`<rect x="1.2" y="1.2" width="${w - 2.4}" height="${h - 2.4}" fill="none" stroke="${theme.line}" stroke-width="2"/>`)
  parts.push('</g>')
  return parts.join('')
}

export function applyPositions(svg: SVGSVGElement, play: Play, positions: Map<string, Point>, camera: Camera): void {
  for (const player of play.players) {
    const el = svg.querySelector(`[data-player-id="${cssEscape(player.id)}"]`)
    if (!el) continue
    const at = positions.get(player.id) ?? { x: player.x, y: player.y }
    const pos = fieldToSvg(at, camera)
    el.setAttribute('transform', `translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})`)
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/"/g, '\\"')
}
