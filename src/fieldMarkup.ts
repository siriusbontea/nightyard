import { ballMarkup } from './ball'
import { COLOR_ART, END_ZONE_COLOR, END_ZONE_LINE, LINE_ART, placeEndZoneLogo } from './endZoneArt'
import { END_ZONE_DEPTH, FIELD_LENGTH, HASH_INSET, displayedYard, fieldYAt, numberArrow } from './fieldMarks'
import { FIELD_WIDTH, PLAYER_R, displayStroke, dist, fieldToSvg, markerReach, plantedMarker, segmentLength, segmentTangent, strokeFromRim, viewSize, type Camera } from './geometry'
import { isPlayerShown } from './play'
import { isZonePreset, zoneRadius } from './presets'
import { routeInk, type RouteInk } from './routeStyle'
import { ACCENT, type Theme } from './theme'
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

const OFFENSE_INK = '#F4F1EA'
const DEFENSE_INK = '#D6F25C'

function routeColor(stroke: Stroke, play: Play, theme: Theme): string {
  if (theme.outlineOnly) return '#111111'
  const player = play.players.find((item) => item.id === stroke.playerId)
  return player?.side === 'defense' ? DEFENSE_INK : OFFENSE_INK
}

function pathD(stroke: Stroke, camera: Camera): string {
  const points = stroke.points.map((point) => fieldToSvg(point, camera))
  const freehand = stroke.points.length >= 5 && stroke.curves.every((curve) => !curve)
  if (freehand) return midpointChain(points)
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

/** C1 chain: each drawn point is a control, and the path passes through the midpoints. */
function midpointChain(points: Point[]): string {
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  const first = mid(points[0], points[1])
  d += ` L${first.x.toFixed(2)} ${first.y.toFixed(2)}`
  for (let i = 1; i < points.length - 1; i++) {
    const control = points[i]
    const to = mid(points[i], points[i + 1])
    d += ` Q${control.x.toFixed(2)} ${control.y.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
  }
  const last = points[points.length - 1]
  d += ` L${last.x.toFixed(2)} ${last.y.toFixed(2)}`
  return d
}

function arrowPath(tip: Point, dir: Point, length: number, width: number): string {
  const len = Math.hypot(dir.x, dir.y) || 1
  const ux = dir.x / len
  const uy = dir.y / len
  const px = -uy
  const py = ux
  const base = { x: tip.x - ux * length, y: tip.y - uy * length }
  const left = { x: base.x + px * (width / 2), y: base.y + py * (width / 2) }
  const right = { x: base.x - px * (width / 2), y: base.y - py * (width / 2) }
  return `M${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L${left.x.toFixed(2)} ${left.y.toFixed(2)} L${right.x.toFixed(2)} ${right.y.toFixed(2)} Z`
}

type HeadKind = 'arrow' | 'bar' | 'chevron' | 'dot' | 'diamond' | 'zone' | 'none'

function headKind(stroke: Stroke): HeadKind {
  if (isZonePreset(stroke.preset)) return 'zone'
  if (stroke.preset === 'contain' || stroke.kind === 'block') return 'bar'
  if (stroke.kind === 'motion') return 'chevron'
  if (stroke.preset === 'man') return 'diamond'
  if (stroke.preset === 'hitch' || stroke.preset === 'curl') return 'dot'
  return 'arrow'
}

/** Pull the stroked end back under the head so the cap never sticks past the tip. */
function trimStroke(stroke: Stroke, yards: number): Stroke {
  if (yards <= 0.05 || stroke.points.length < 2) return stroke
  const points = stroke.points.map((point) => ({ ...point }))
  const curves = stroke.curves.map((curve) => (curve ? { ...curve } : null))
  let remain = yards
  while (points.length >= 2 && remain > 0.02) {
    const a = points[points.length - 2]
    const b = points[points.length - 1]
    const curve = curves[curves.length - 1] ?? null
    const len = segmentLength(a, b, curve)
    const dir = segmentTangent(a, b, curve, 1)
    const mag = Math.hypot(dir.x, dir.y) || 1
    if (len <= remain + 0.04) {
      remain -= len
      points.pop()
      curves.pop()
      continue
    }
    points[points.length - 1] = { x: b.x - (dir.x / mag) * remain, y: b.y - (dir.y / mag) * remain }
    remain = 0
  }
  if (points.length < 2) return stroke
  return { ...stroke, points, curves }
}

function headMarkup(kind: HeadKind, tip: Point, dir: Point, ink: RouteInk, color: string, halo: string, zone: { rx: number; ry: number } | null, scale: number, print: boolean): string {
  const round = (ink.phone ? 1 : 1) / Math.max(ink.stroke / 3.2, 0.2)
  if (kind === 'zone' && zone) {
    const fill = print ? 'none' : color
    const opacity = print ? '' : ' fill-opacity="0.18"'
    return `<ellipse cx="${tip.x.toFixed(1)}" cy="${tip.y.toFixed(1)}" rx="${(zone.rx * scale).toFixed(1)}" ry="${(zone.ry * scale).toFixed(1)}" fill="${fill}"${opacity} stroke="${halo}" stroke-width="${(ink.halo * 2).toFixed(2)}"/><ellipse cx="${tip.x.toFixed(1)}" cy="${tip.y.toFixed(1)}" rx="${(zone.rx * scale).toFixed(1)}" ry="${(zone.ry * scale).toFixed(1)}" fill="${fill}"${opacity} stroke="${color}" stroke-width="${ink.stroke.toFixed(2)}"/>`
  }
  if (kind === 'bar') {
    const len = Math.hypot(dir.x, dir.y) || 1
    const px = -dir.y / len
    const py = dir.x / len
    const half = ink.headWidth / 2
    const x1 = tip.x + px * half
    const y1 = tip.y + py * half
    const x2 = tip.x - px * half
    const y2 = tip.y - py * half
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${halo}" stroke-width="${(ink.stroke + ink.halo * 2).toFixed(2)}" stroke-linecap="round"/>
      <line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-width="${ink.stroke.toFixed(2)}" stroke-linecap="round"/>`
  }
  if (kind === 'chevron') {
    const len = Math.hypot(dir.x, dir.y) || 1
    const ux = dir.x / len
    const uy = dir.y / len
    const px = -uy
    const py = ux
    const back = ink.head * 0.85
    const wing = ink.headWidth * 0.42
    const left = { x: tip.x - ux * back + px * wing, y: tip.y - uy * back + py * wing }
    const right = { x: tip.x - ux * back - px * wing, y: tip.y - uy * back - py * wing }
    const d = `M${left.x.toFixed(2)} ${left.y.toFixed(2)} L${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L${right.x.toFixed(2)} ${right.y.toFixed(2)}`
    return `<path d="${d}" fill="none" stroke="${halo}" stroke-width="${(ink.stroke + ink.halo * 2).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="${ink.stroke.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`
  }
  if (kind === 'dot') {
    const r = ink.head * 0.36
    return `<circle cx="${tip.x.toFixed(2)}" cy="${tip.y.toFixed(2)}" r="${(r + ink.halo).toFixed(2)}" fill="${halo}"/><circle cx="${tip.x.toFixed(2)}" cy="${tip.y.toFixed(2)}" r="${r.toFixed(2)}" fill="${color}"/>`
  }
  if (kind === 'diamond') {
    const len = Math.hypot(dir.x, dir.y) || 1
    const ux = dir.x / len
    const uy = dir.y / len
    const px = -uy
    const py = ux
    const reach = ink.head * 0.42
    const wide = ink.headWidth * 0.28
    const pts = [
      { x: tip.x + ux * reach, y: tip.y + uy * reach },
      { x: tip.x + px * wide, y: tip.y + py * wide },
      { x: tip.x - ux * reach, y: tip.y - uy * reach },
      { x: tip.x - px * wide, y: tip.y - py * wide },
    ]
    const d = `M${pts.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L')} Z`
    return `<path d="${d}" fill="${halo}" stroke="${halo}" stroke-width="${ink.halo.toFixed(2)}" stroke-linejoin="round"/><path d="${d}" fill="${color}" stroke="${color}" stroke-width="${(round * 0.4).toFixed(2)}" stroke-linejoin="round"/>`
  }
  const d = arrowPath(tip, dir, ink.head, ink.headWidth)
  const haloPath = arrowPath(tip, dir, ink.head + ink.halo, ink.headWidth + ink.halo * 2)
  const corner = (1 / Math.max(ink.stroke / (ink.phone ? 3.2 : 4), 0.2)).toFixed(2)
  return `<path d="${haloPath}" fill="${halo}" stroke="${halo}" stroke-width="${ink.halo.toFixed(2)}" stroke-linejoin="round"/>
    <path d="${d}" fill="${color}" stroke="${color}" stroke-width="${corner}" stroke-linejoin="round"/>`
}

function keepTipOnField(tip: Point, dir: Point, pad: number, width: number, height: number): Point {
  const len = Math.hypot(dir.x, dir.y) || 1
  const ux = dir.x / len
  const uy = dir.y / len
  let x = tip.x
  let y = tip.y
  for (let step = 0; step < 12; step++) {
    if (x >= pad && x <= width - pad && y >= pad && y <= height - pad) break
    x -= ux * pad * 0.35
    y -= uy * pad * 0.35
  }
  return { x, y }
}

function routeParts(stroke: Stroke, play: Play, camera: Camera, theme: Theme, selected: boolean, dim: boolean, pxPerUnit: number): { body: string; head: string } {
  const shown = strokeFromRim(displayStroke(stroke, play.players), play.players)
  if (shown.points.length < 2) return { body: '', head: '' }
  const { w, h } = viewSize(camera)
  const ink = routeInk(pxPerUnit, pxPerUnit * w, false)
  const weight = selected ? 1.25 : 1
  const color = routeColor(shown, play, theme)
  const halo = theme.outlineOnly ? '#ffffff' : theme.routeOutline
  const kind = headKind(shown)
  const end = shown.points[shown.points.length - 1]
  const prev = shown.points[shown.points.length - 2]
  const fieldDir = segmentTangent(prev, end, shown.curves[shown.curves.length - 1] ?? null, 1)
  const dir = { x: fieldDir.x, y: -fieldDir.y }
  const tip = keepTipOnField(fieldToSvg(end, camera), dir, ink.head * 0.55, w, h)
  const trimYards = kind === 'zone' ? 0 : ink.trim / camera.scale
  const bodyStroke = trimStroke(shown, trimYards)
  const d = pathD(bodyStroke, camera)
  const dashed = shown.kind === 'motion'
  const dash = dashed ? ` stroke-dasharray="${ink.motionOn.toFixed(2)} ${ink.motionOff.toFixed(2)}"` : ''
  const opacity = dim ? ' opacity="0.65"' : ''
  const start = fieldToSvg(bodyStroke.points[0], camera)
  const haloW = ((ink.stroke + ink.halo * 2) * weight).toFixed(2)
  const innerW = (ink.stroke * weight).toFixed(2)
  const highlight = selected
    ? `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${ink.highlight.toFixed(2)}" stroke-linecap="butt" stroke-linejoin="round"${dash} opacity="0.9"/>`
    : ''
  const dirLen = Math.hypot(dir.x, dir.y) || 1
  const ball =
    shown.kind === 'run'
      ? ballMarkup(
          start.x + (dir.x / dirLen) * ink.stroke * 2.2,
          start.y + (dir.y / dirLen) * ink.stroke * 2.2,
          Math.max(3.5, ink.stroke * 1.35),
          theme.ballFill,
          theme.ballStroke,
        )
      : ''
  const zone = zoneRadius(shown.preset)
  const head = headMarkup(kind, tip, dir, ink, color, halo, zone, camera.scale, theme.outlineOnly)
  const attrs = `${shown.preset ? ` data-preset="${shown.preset}"` : ''}${isZonePreset(shown.preset) ? ' data-zone="1"' : ''}${opacity}`
  return {
    body: `<g data-layer="route" data-stroke-id="${shown.id}"${attrs}>
      <path d="${d}" fill="none" stroke="${halo}" stroke-width="${haloW}" stroke-linecap="butt" stroke-linejoin="round"${dash} stroke-opacity="0.55"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="${innerW}" stroke-linecap="butt" stroke-linejoin="round"${dash}/>
      ${highlight}${ball}
    </g>`,
    head: `<g data-layer="head" data-stroke-id="${shown.id}"${attrs}>${head}</g>`,
  }
}

function clearOfMarkers(point: Point, play: Play): Point {
  let next = { ...point }
  for (const player of play.players) {
    const center = plantedMarker(player)
    const gap = markerReach(player.shape) + 0.7
    const distance = dist(next, center)
    if (distance >= gap || distance < 0.01) continue
    next = {
      x: center.x + ((next.x - center.x) / distance) * gap,
      y: center.y + ((next.y - center.y) / distance) * gap,
    }
  }
  return next
}

function handlesMarkup(stroke: Stroke, play: Play, camera: Camera, pxPerUnit: number, coarse: boolean): string {
  const { w } = viewSize(camera)
  const ink = routeInk(pxPerUnit, pxPerUnit * w, coarse)
  const parts: string[] = []
  const ring = Math.max(1.2, ink.handle * 0.18)
  const pxPerYard = pxPerUnit * camera.scale
  for (let i = 1; i < stroke.points.length; i++) {
    const point = fieldToSvg(clearOfMarkers(stroke.points[i], play), camera)
    parts.push(
      `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${ink.handle.toFixed(2)}" fill="#ffffff" stroke="#140E0C" stroke-width="${ring.toFixed(2)}"/>
      <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${(ink.handle + ring).toFixed(2)}" fill="none" stroke="#ffffff" stroke-width="${(ring * 0.7).toFixed(2)}"/>`,
    )
  }
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const a = stroke.points[i]
    const b = stroke.points[i + 1]
    const curve = stroke.curves[i] ?? null
    if (dist(a, b) * pxPerYard < 80) continue
    const mid = clearOfMarkers(curve ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, play)
    const at = fieldToSvg(mid, camera)
    const r = ink.midHandle
    parts.push(
      `<circle cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${r.toFixed(2)}" fill="#ffffff" stroke="${ACCENT}" stroke-width="${ring.toFixed(2)}"/>
      <path d="M${at.x.toFixed(1)} ${(at.y - r * 0.45).toFixed(1)} V${(at.y + r * 0.45).toFixed(1)} M${(at.x - r * 0.45).toFixed(1)} ${at.y.toFixed(1)} H${(at.x + r * 0.45).toFixed(1)}" fill="none" stroke="#140E0C" stroke-width="${Math.max(1.2, ring * 0.7).toFixed(2)}" stroke-linecap="round"/>`,
    )
  }
  return `<g data-layer="handles">${parts.join('')}</g>`
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

function playerMarkup(player: Player, play: Play, camera: Camera, theme: Theme, selected: boolean, pxPerUnit: number, drawReady: boolean): { shape: string; label: string } {
  const pos = fieldToSvg(plantedMarker(player), camera)
  const radius = PLAYER_R * camera.scale
  const fill = theme.outlineOnly ? '#ffffff' : safeColor(player.color)
  const stroke = theme.outlineOnly ? '#161616' : '#0c1220'
  const sw = theme.outlineOnly ? 2.2 : Math.max(0.8, 1.5 / Math.max(pxPerUnit, 0.04))
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
  const ring = selected && theme.interactive
    ? `<circle r="${(radius + 4.2).toFixed(1)}" fill="none" stroke="#ffffff" stroke-width="${Math.max(1.4, 2.2 / Math.max(pxPerUnit, 0.04)).toFixed(2)}" opacity="0.95"/>`
    : ''
  const ready = drawReady
    ? `<circle class="draw-ready" r="${(radius + 3.4).toFixed(1)}" fill="none" stroke="${ACCENT}" stroke-width="${Math.max(1.2, 1.75 / Math.max(pxPerUnit, 0.04)).toFixed(2)}"/>`
    : ''
  const minLabel = 12 / Math.max(pxPerUnit, 0.04)
  const size = Math.max(labelFontSize(player.label, radius, player.shape), Math.min(minLabel, radius * 1.05))
  const haloPx = Math.max(1.1, 1.5 / Math.max(pxPerUnit, 0.04))
  const label = `<text x="0" y="0" fill="${labelInk(fill)}" stroke="#0c1220" stroke-width="${haloPx.toFixed(2)}" paint-order="stroke" font-family="Oswald, Impact, sans-serif" font-size="${size.toFixed(1)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${escapeXml(player.label)}</text>`
  let badge = ''
  if (player.read && player.side === ourSideOf(play)) {
    const bx = radius * 0.82
    const by = -radius * 0.82
    badge = `<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><circle r="9.5" fill="${theme.badgeFill}" stroke="${theme.badgeStroke}" stroke-width="1.6"/><text fill="${theme.badgeText}" font-family="Oswald, Impact, sans-serif" font-size="12" font-weight="600" text-anchor="middle" dominant-baseline="central">${player.read}</text></g>`
  }
  const at = `translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})`
  const id = escapeXml(player.id)
  return {
    shape: `<g data-player-id="${id}" transform="${at}">${ready}${ring}${shape}</g>`,
    label: `<g data-layer="label" data-player-id="${id}" transform="${at}">${label}${badge}</g>`,
  }
}

function yardArrow(x: number, y: number, dir: 'up' | 'down', scale: number): string {
  const height = 1.45 * scale
  const half = 0.62 * scale
  const tip = dir === 'up' ? y - height : y + height
  const base = y
  return `M${x.toFixed(1)} ${tip.toFixed(1)} L${(x - half).toFixed(1)} ${base.toFixed(1)} L${(x + half).toFixed(1)} ${base.toFixed(1)} Z`
}

/**
 * Sideways 10-yard numbers, counting up to midfield and back down, with a goal arrow.
 * x/y have to be the rotation center. A rotate() around the sideline with the
 * glyph still at 0,0 swings the digits off the field.
 */
function yardNumbers(los: number, scale: number, ahead: number, height: number, theme: Theme): string {
  const parts: string[] = []
  const size = 3.6 * scale
  // 12 yards in from each sideline, clear of the split ends on the line.
  const left = 12 * scale
  const right = (FIELD_WIDTH - 12) * scale
  const fade = theme.outlineOnly ? '' : ' fill-opacity="0.45"'
  const attrs = `fill="${theme.number}"${fade} stroke="${theme.numberStroke}" stroke-width="${(scale * 0.16).toFixed(2)}" paint-order="stroke" font-family="Oswald, Impact, sans-serif" font-size="${size.toFixed(1)}" font-weight="500" text-anchor="middle" dominant-baseline="central"`
  for (let yard = 10; yard <= 90; yard += 10) {
    const y = (ahead - fieldYAt(los, yard)) * scale
    if (y < size * 0.55 || y > height - size * 0.55) continue
    const label = displayedYard(yard)
    const arrow = numberArrow(yard)
    const lx = left.toFixed(1)
    const rx = right.toFixed(1)
    const yy = y.toFixed(1)
    parts.push(`<text x="${lx}" y="${yy}" ${attrs} transform="rotate(-90 ${lx} ${yy})">${label}</text>`)
    parts.push(`<text x="${rx}" y="${yy}" ${attrs} transform="rotate(90 ${rx} ${yy})">${label}</text>`)
    if (!arrow) continue
    const shift = (arrow === 'up' ? -1 : 1) * size * 0.78
    const inset = size * 0.62
    parts.push(`<path data-arrow="${arrow}" data-arrow-for="${label}" d="${yardArrow(left + inset, y + shift, arrow, scale)}" fill="${theme.number}"/>`)
    parts.push(`<path data-arrow="${arrow}" data-arrow-for="${label}" d="${yardArrow(right - inset, y + shift, arrow, scale)}" fill="${theme.number}"/>`)
  }
  return parts.join('')
}

/** Logo centered in one end zone, under the lines. `upright` faces the far goal. */
function endZoneArt(top: number, height: number, width: number, upright: boolean, print: boolean): string {
  const placed = placeEndZoneLogo(top, height, width, print ? LINE_ART : COLOR_ART)
  const href = escapeXml(print ? END_ZONE_LINE : END_ZONE_COLOR)
  const image = `<image href="${href}" x="${placed.x.toFixed(1)}" y="${placed.y.toFixed(1)}" width="${placed.width.toFixed(1)}" height="${placed.height.toFixed(1)}" preserveAspectRatio="none"/>`
  const opacity = print ? '1' : '0.16'
  if (upright) return `<g data-endzone="far" opacity="${opacity}" pointer-events="none">${image}</g>`
  return `<g data-endzone="near" opacity="${opacity}" pointer-events="none" transform="rotate(180 ${placed.centerX.toFixed(1)} ${placed.centerY.toFixed(1)})">${image}</g>`
}

/**
 * Line of scrimmage on the snap yard line, sideline to sideline.
 * No filter: a flat line has no height, and a bounding-box glow clips it.
 * The chip sits on the left sideline, just behind the line, clear of the players.
 */
function scrimmageMarkup(losY: string, width: number, scale: number, theme: Theme): string {
  const print = theme.outlineOnly
  const edge = print ? 6.4 : 6.8
  const parts = [
    `<line data-los="edge" x1="0" y1="${losY}" x2="${width}" y2="${losY}" stroke="#ffffff" stroke-width="${edge}" pointer-events="none"/>`,
  ]
  const dash = print ? ' stroke-dasharray="0.01 9" stroke-linecap="round"' : ''
  parts.push(
    `<line data-los="line" x1="0" y1="${losY}" x2="${width}" y2="${losY}" stroke="${theme.los}" stroke-width="4"${dash} pointer-events="none"/>`,
  )
  const chipW = 32
  const chipH = 14
  const chipX = (0.28 * scale).toFixed(1)
  const chipY = (Number(losY) + 0.4 * scale).toFixed(1)
  const ink = print ? '#111111' : theme.los
  parts.push(
    `<g data-los="chip" pointer-events="none" transform="translate(${chipX} ${chipY})"><rect width="${chipW}" height="${chipH}" rx="7" fill="#ffffff" stroke="${ink}" stroke-width="1.2"/><text x="${(chipW / 2).toFixed(1)}" y="${(chipH / 2).toFixed(1)}" fill="${ink}" font-family="Oswald, Impact, sans-serif" font-size="11" text-anchor="middle" dominant-baseline="central">LINE</text></g>`,
  )
  return parts.join('')
}

export function fieldMarkup(options: {
  play: Play
  camera: Camera
  theme: Theme
  selectedPlayerId?: string | null
  selectedStrokeId?: string | null
  showHandles?: boolean
  /** CSS pixels per SVG unit. Defaults to 1 so a standalone diagram stays in its own pixels. */
  pxPerUnit?: number
  coarse?: boolean
  drawMode?: boolean
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
    <radialGradient id="vig-${theme.id}" cx="50%" cy="40%" r="75%">
      <stop offset="70%" stop-color="${theme.vignette ?? '#000'}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${theme.vignette ?? '#000'}" stop-opacity="0.2"/>
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
    // Far end zone stays upright. The near one is turned so both read toward the field.
    parts.push(endZoneArt(y, height, w, goal === 0, theme.outlineOnly))
  }
  if (theme.grain) {
    parts.push(`<rect width="${w}" height="${h}" filter="url(#grain-${theme.id})" opacity="${theme.id === 'night' ? 0.06 : 0.04}"/>`)
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
  parts.push(scrimmageMarkup(svgY(fieldYAt(play.los, play.los)).toFixed(2), w, scale, theme))
  const ball = fieldToSvg({ x: FIELD_WIDTH / 2, y: -0.85 }, camera)
  parts.push(ballMarkup(ball.x, ball.y, scale, theme.ballFill, theme.ballStroke))
  parts.push(yardNumbers(play.los, scale, ahead, h, theme))
  const pxPerUnit = options.pxPerUnit && options.pxPerUnit > 0 ? options.pxPerUnit : 1
  const visible = (player: Player) => isPlayerShown(play, player)
  const strokes = play.strokes.filter((stroke) => {
    const owner = play.players.find((player) => player.id === stroke.playerId)
    return owner ? visible(owner) : false
  })
  const drawn = strokes.map((stroke) =>
    routeParts(stroke, play, camera, theme, stroke.id === options.selectedStrokeId, Boolean(options.selectedStrokeId) && stroke.id !== options.selectedStrokeId, pxPerUnit),
  )
  const ordered = [
    ...play.players.filter((player) => player.side !== ourSideOf(play) && play.showDefense),
    ...play.players.filter((player) => player.side === ourSideOf(play)),
  ]
  const labels: string[] = []
  for (const player of ordered) {
    const hasLine = play.strokes.some((stroke) => stroke.playerId === player.id)
    const drawReady = Boolean(options.drawMode) && player.side === ourSideOf(play) && !hasLine
    const drawnPlayer = playerMarkup(player, play, camera, theme, player.id === options.selectedPlayerId, pxPerUnit, drawReady)
    parts.push(drawnPlayer.shape)
    labels.push(drawnPlayer.label)
  }
  for (const piece of drawn) parts.push(piece.body)
  for (const piece of drawn) parts.push(piece.head)
  parts.push(...labels)
  if (options.showHandles && options.selectedStrokeId) {
    const selected = play.strokes.find((stroke) => stroke.id === options.selectedStrokeId)
    if (selected) parts.push(handlesMarkup(displayStroke(selected, play.players), play, camera, pxPerUnit, Boolean(options.coarse)))
  }
  parts.push(`<rect x="1.2" y="1.2" width="${w - 2.4}" height="${h - 2.4}" fill="none" stroke="${theme.line}" stroke-width="2"/>`)
  parts.push('</g>')
  return parts.join('')
}

export function applyPositions(svg: SVGSVGElement, play: Play, positions: Map<string, Point>, camera: Camera): void {
  for (const player of play.players) {
    const at = positions.get(player.id) ?? { x: player.x, y: player.y }
    const pos = fieldToSvg(at, camera)
    const transform = `translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})`
    for (const el of svg.querySelectorAll(`[data-player-id="${cssEscape(player.id)}"]`)) {
      el.setAttribute('transform', transform)
    }
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/"/g, '\\"')
}
