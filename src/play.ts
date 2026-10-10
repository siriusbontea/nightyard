import { categoryOf } from './categories'
import { DEFAULT_LOS, HASH_INSET } from './fieldMarks'
import { OUR_COLOR, THEIR_COLOR, defenseFor, formationById, offenseFor, playerFromSpot, routeColorAt, shapeFor, type Spot } from './formations'
import { FIELD_WIDTH, insideDir, pointOnStroke } from './geometry'
import { canRedo, canUndo, commit, createHistory, redo, undo, type History } from './history'
import { uid } from './id'
import { playerAtTime } from './playback'
import { isDirectionalPreset, kindForPreset, kindLabel, makeStroke, presetFromPlayer, presetLabel } from './presets'
import type { FormatId, Play, Player, Point, PresetId, Side, Stroke, StrokeKind } from './types'
import { FORMATS, isFormatId, ourSideOf } from './types'

export { canRedo, canUndo, commit, createHistory, redo, undo }
export type { History }

export function ballLabel(los: number): string {
  return los === 50 ? 'the 50' : `the ${los}`
}

export function createPlay(options: {
  format: FormatId
  formationId?: string
  name?: string
  id?: string
}): Play {
  const formation = formationById(options.format, options.formationId ?? formationById(options.format, '').id)
  const now = Date.now()
  return rememberStart({
    id: options.id ?? uid(),
    name: options.name ?? 'New play',
    formation: formation.name,
    formationId: formation.id,
    format: options.format,
    los: DEFAULT_LOS,
    category: 'Pass play',
    notes: '',
    ourSide: 'offense',
    showDefense: false,
    players: offenseFor(options.format, formation.id),
    strokes: [],
    createdAt: now,
    updatedAt: now,
  })
}

function withoutOrigin(play: Play): Play {
  const copy = JSON.parse(JSON.stringify(play)) as Play
  delete copy.origin
  return copy
}

/** Remember the starting look once. Later edits do not move it. */
export function rememberStart(play: Play): Play {
  if (play.origin) return play
  return { ...play, origin: withoutOrigin(play) }
}

/** Put this play back to its starting look. The id stays so the rest of the book is untouched. */
export function resetPlay(play: Play): Play {
  const start = JSON.parse(JSON.stringify(play.origin ?? withoutOrigin(play))) as Play
  delete start.origin
  return {
    ...start,
    id: play.id,
    createdAt: play.createdAt,
    updatedAt: Date.now(),
    origin: JSON.parse(JSON.stringify(start)) as Play,
  }
}

function lined(spots: Spot[], side: Side, mine: boolean, routeStart: number): Player[] {
  return spots.map((item, index) => playerFromSpot(item, side, mine, routeStart + index))
}

function drawn(playerId: string, kind: StrokeKind, preset: PresetId | null, points: Point[], curveAt?: Point): Stroke {
  return {
    id: uid(),
    playerId,
    kind,
    points,
    curves: points.slice(1).map((_, index) => (index === points.length - 2 ? (curveAt ?? null) : null)),
    preset,
  }
}

/** Goal-line bunch. A fresh book starts here. New play uses the 30. A book that already has plays is left alone. */
export function corndogPlay(name = 'Corndog'): Play {
  const ball = FIELD_WIDTH - HASH_INSET
  const play = createPlay({ format: '11v11', formationId: 'trips-bunch', name })
  play.los = 3
  play.showDefense = true
  play.notes = 'Outside man walks in, then cuts back to the pylon. Tight end bends to the corner. Back slips up for a shovel.'
  const offense = lined(
    [
      { label: 'LT', role: 'ol', x: ball - 8.1, y: 0 },
      { label: 'LG', role: 'ol', x: ball - 3.8, y: 0 },
      { label: 'C', role: 'center', x: ball, y: -0.15 },
      { label: 'RG', role: 'ol', x: ball + 3.6, y: 0 },
      { label: 'RT', role: 'ol', x: ball + 6.4, y: 0 },
      { label: 'Y', role: 'te', x: ball + 10.6, y: 0 },
      { label: 'TE', role: 'te', x: ball + 12.4, y: 0.35 },
      { label: 'X', role: 'wr', x: ball + 14.6, y: 0 },
      { label: 'Z', role: 'wr', x: 6.4, y: 0 },
      { label: 'QB', role: 'qb', x: ball, y: -5 },
      { label: 'RB', role: 'rb', x: ball + 2.6, y: -4.8 },
    ],
    'offense',
    true,
    0,
  )
  const defense = lined(
    [
      { label: 'E', role: 'dl', x: ball - 7.2, y: 1.05 },
      { label: 'N', role: 'dl', x: ball - 2.4, y: 1.05 },
      { label: 'T', role: 'dl', x: ball + 2.2, y: 1.05 },
      { label: 'J', role: 'dl', x: ball + 6.6, y: 1.05 },
      { label: 'W', role: 'lb', x: ball - 10.4, y: 2.5 },
      { label: 'M', role: 'lb', x: ball, y: 2.6 },
      { label: '$', role: 'lb', x: ball + 5.4, y: 2.4 },
      { label: 'LC', role: 'db', x: 6.4, y: 1.7 },
      { label: 'SS', role: 'db', x: ball + 10.6, y: 1.8 },
      { label: 'FS', role: 'db', x: ball + 4.2, y: 5.6 },
      { label: 'RC', role: 'db', x: ball + 14.6, y: 1.75 },
    ],
    'defense',
    false,
    11,
  )
  play.players = [...offense, ...defense]
  const byLabel = Object.fromEntries(play.players.map((player) => [player.label, player]))
  byLabel.X.read = 1
  byLabel.Y.read = 2
  byLabel.RB.read = 3
  const x = byLabel.X
  const y = byLabel.Y
  const tight = byLabel.TE
  const z = byLabel.Z
  const back = byLabel.RB
  const snapX = x.x - 4.1
  play.strokes = [
    drawn(x.id, 'motion', 'motion', [
      { x: x.x, y: x.y },
      { x: snapX, y: 0.15 },
    ]),
    drawn(x.id, 'route', null, [
      { x: snapX, y: 0.15 },
      { x: x.x - 0.4, y: 0.45 },
      { x: Math.min(FIELD_WIDTH - 2.4, x.x + 2.6), y: 3.8 },
    ]),
    drawn(
      y.id,
      'route',
      'corner',
      [
        { x: y.x, y: y.y },
        { x: y.x + 0.3, y: 2.5 },
        { x: y.x + 5.2, y: 6.3 },
      ],
      { x: y.x + 2.2, y: 5.1 },
    ),
    drawn(tight.id, 'block', 'block', [
      { x: tight.x, y: tight.y },
      { x: tight.x, y: 1.7 },
    ]),
    drawn(z.id, 'route', 'go', [
      { x: z.x, y: z.y },
      { x: z.x - 0.3, y: 5.8 },
    ]),
    drawn(back.id, 'run', 'run', [
      { x: back.x, y: back.y },
      { x: back.x + 2.2, y: -0.7 },
    ]),
  ]
  delete play.origin
  return rememberStart(play)
}

export function showcasePlay(): Play {
  return corndogPlay()
}

export function duplicatePlay(play: Play): Play {
  const idMap = new Map<string, string>()
  const players = play.players.map((player) => {
    const id = uid()
    idMap.set(player.id, id)
    return { ...player, id }
  })
  const strokes = play.strokes.map((stroke) => ({
    ...stroke,
    id: uid(),
    playerId: idMap.get(stroke.playerId) ?? stroke.playerId,
    coverId: stroke.coverId ? (idMap.get(stroke.coverId) ?? stroke.coverId) : stroke.coverId,
    points: stroke.points.map((point) => ({ ...point })),
    curves: stroke.curves.map((curve) => (curve ? { ...curve } : null)),
  }))
  const now = Date.now()
  const copy: Play = {
    ...play,
    id: uid(),
    name: `${play.name} copy`,
    players,
    strokes,
    createdAt: now,
    updatedAt: now,
  }
  delete copy.origin
  return rememberStart(copy)
}

export function renamePlay(play: Play, name: string): Play {
  const trimmed = name.trim()
  return { ...play, name: trimmed || play.name }
}

export function translatePlayer(play: Play, playerId: string, x: number, y: number): Play {
  const player = play.players.find((item) => item.id === playerId)
  if (!player) return play
  const dx = x - player.x
  const dy = y - player.y
  return {
    ...play,
    players: play.players.map((item) => (item.id === playerId ? { ...item, x, y } : item)),
    strokes: play.strokes.map((stroke) =>
      stroke.playerId === playerId
        ? {
            ...stroke,
            points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
            curves: stroke.curves.map((curve) => (curve ? { x: curve.x + dx, y: curve.y + dy } : null)),
          }
        : stroke,
    ),
  }
}

export function updatePlayer(play: Play, playerId: string, patch: Partial<Player>): Play {
  return {
    ...play,
    players: play.players.map((player) => (player.id === playerId ? { ...player, ...patch, id: player.id, side: player.side } : player)),
  }
}

export function setStroke(play: Play, stroke: Stroke): Play {
  const strokes = play.strokes.filter((item) => !(item.playerId === stroke.playerId && item.kind === stroke.kind))
  return { ...play, strokes: [...strokes, stroke] }
}

/** The line this player is running. Motion before the snap is separate. */
export function mainStroke(play: Play, playerId: string): Stroke | undefined {
  return play.strokes.find((stroke) => stroke.playerId === playerId && stroke.kind !== 'motion')
}

/** A new route, run, or block replaces the old one. It does not sit on top. Motion stays. */
export function replaceMainStroke(play: Play, stroke: Stroke): Play {
  if (stroke.kind === 'motion') return setStroke(play, stroke)
  const strokes = play.strokes.filter((item) => !(item.playerId === stroke.playerId && item.kind !== 'motion'))
  return { ...play, strokes: [...strokes, stroke] }
}

export function removeRoute(play: Play, playerId: string): Play {
  const theirs = play.strokes.filter((stroke) => stroke.playerId === playerId)
  const main = theirs.some((stroke) => stroke.kind !== 'motion')
  if (main) return { ...play, strokes: play.strokes.filter((stroke) => !(stroke.playerId === playerId && stroke.kind !== 'motion')) }
  return clearPlayerStrokes(play, playerId)
}

export function replaceStroke(play: Play, stroke: Stroke): Play {
  return { ...play, strokes: play.strokes.map((item) => (item.id === stroke.id ? stroke : item)) }
}

export function deleteStroke(play: Play, strokeId: string): Play {
  return { ...play, strokes: play.strokes.filter((stroke) => stroke.id !== strokeId) }
}

export function clearPlayerStrokes(play: Play, playerId: string): Play {
  return { ...play, strokes: play.strokes.filter((stroke) => stroke.playerId !== playerId) }
}

/** Where a path starts. A path after motion leaves from the end of that motion. */
export function presetOrigin(play: Play, playerId: string, preset: PresetId): Point | undefined {
  if (kindForPreset(preset) === 'motion') return undefined
  const motion = play.strokes.find((stroke) => stroke.playerId === playerId && stroke.kind === 'motion')
  return motion ? pointOnStroke(motion, 1) : undefined
}

/** The path already on this player, so the Paths screen can show it as chosen. */
export function presetOnPlayer(play: Play, playerId: string): PresetId | null {
  const strokes = play.strokes.filter((stroke) => stroke.playerId === playerId && stroke.preset)
  const main = strokes.find((stroke) => stroke.kind !== 'motion')
  return (main ?? strokes[0])?.preset ?? null
}

/** Offense faces upfield. Left is the left side of the screen. */
export type BreakSide = 'left' | 'right'

/** Inside breaks go toward midfield. A player in the middle breaks right. */
export function defaultBreakSide(x: number): BreakSide {
  return insideDir(x) === 1 ? 'right' : 'left'
}

/** +1 sends an inside break toward the right side of the screen. */
export function insideSign(side: BreakSide): -1 | 1 {
  return side === 'right' ? 1 : -1
}

/** Which way this line already breaks. Straight routes have no side. */
export function routeBreakSide(stroke: Stroke): BreakSide | null {
  if (stroke.preset && !isDirectionalPreset(stroke.preset)) return null
  const start = stroke.points[0]
  if (!start) return null
  const drifted = stroke.points.find((point) => Math.abs(point.x - start.x) > 0.35)
  if (!drifted) return null
  return drifted.x < start.x - 0.05 ? 'left' : 'right'
}

export function ballXOf(play: Play): number {
  const center = play.players.find((player) => player.role === 'center')
  const qb = play.players.find((player) => player.role === 'qb')
  return center?.x ?? qb?.x ?? FIELD_WIDTH / 2
}

export function applyPreset(play: Play, playerId: string, preset: PresetId, side?: BreakSide): Play {
  const player = play.players.find((item) => item.id === playerId)
  if (!player || preset === 'man') return play
  const ball = ballXOf(play)
  const sign = side ? insideSign(side) : player.side === 'defense' ? insideSign(player.x <= ball ? 'left' : 'right') : insideDir(player.x)
  const stroke = makeStroke(uid(), playerId, preset, presetFromPlayer(preset, player, presetOrigin(play, playerId, preset), sign, ball))
  return replaceMainStroke(play, stroke)
}

/** Dashed man line from a defender to the offensive player they cover. */
export function applyMan(play: Play, playerId: string, targetId: string): Play {
  const player = play.players.find((item) => item.id === playerId)
  const target = play.players.find((item) => item.id === targetId)
  if (!player || !target || target.side === player.side) return play
  const stroke: Stroke = {
    id: uid(),
    playerId,
    kind: 'route',
    points: [
      { x: player.x, y: player.y },
      { x: target.x, y: target.y },
    ],
    curves: [null],
    preset: 'man',
    coverId: targetId,
  }
  return replaceMainStroke(play, stroke)
}

function presetForDefender(player: Player, ball: number): PresetId {
  if (player.role === 'dl') return Math.abs(player.x - ball) > 6 ? 'blitz-edge' : player.x <= ball ? 'blitz-a' : 'blitz-b'
  if (player.role === 'db') {
    if (Math.abs(player.x - ball) > 14) return 'zone-third'
    if (Math.abs(player.x - ball) < 5) return 'zone-middle'
    return 'zone-half'
  }
  return 'zone-hook'
}

/** Zones for the coverage and a rush for the defensive line. One look, not offensive routes. */
export function defaultDefenseStrokes(play: Play): Stroke[] {
  const ball = ballXOf(play)
  const strokes: Stroke[] = []
  for (const player of play.players) {
    if (player.side !== 'defense') continue
    if (play.strokes.some((stroke) => stroke.playerId === player.id)) continue
    const side: BreakSide = player.x <= ball ? 'left' : 'right'
    const preset = presetForDefender(player, ball)
    strokes.push(makeStroke(uid(), player.id, preset, presetFromPlayer(preset, player, undefined, insideSign(side), ball)))
  }
  return strokes
}

function mirrorPoint(point: Point, axis: number): Point {
  return { x: axis * 2 - point.x, y: point.y }
}

/** Flip one player's lines across their own spot, so a slant the other way. */
export function mirrorPlayerRoutes(play: Play, playerId: string): Play {
  const player = play.players.find((item) => item.id === playerId)
  if (!player) return play
  return {
    ...play,
    strokes: play.strokes.map((stroke) =>
      stroke.playerId !== playerId
        ? stroke
        : {
            ...stroke,
            points: stroke.points.map((point) => mirrorPoint(point, player.x)),
            curves: stroke.curves.map((curve) => (curve ? mirrorPoint(curve, player.x) : null)),
          },
    ),
  }
}

/** Mirror the whole formation and every route, left to right. */
export function flipPlay(play: Play): Play {
  const flipX = (x: number) => FIELD_WIDTH - x
  const flip = (point: Point): Point => ({ x: flipX(point.x), y: point.y })
  return {
    ...play,
    players: play.players.map((player) => ({ ...player, x: flipX(player.x) })),
    strokes: play.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map(flip),
      curves: stroke.curves.map((curve) => (curve ? flip(curve) : null)),
    })),
  }
}

export function isPlayerShown(play: Play, player: Player): boolean {
  return player.side === ourSideOf(play) || play.showDefense
}

export function applyFormation(play: Play, format: FormatId, formationId: string): Play {
  const template = formationById(format, formationId)
  const ourSide = ourSideOf(play)
  const offense = offenseFor(format, template.id, ourSide === 'offense', 0)
  const defense = defenseFor(format, ourSide === 'defense', 6)
  const players =
    ourSide === 'defense'
      ? [...defense, ...(play.showDefense ? offense : [])]
      : [...offense, ...(play.showDefense ? defense : [])]
  return {
    ...play,
    format,
    formation: template.name,
    formationId: template.id,
    ourSide,
    players,
    strokes: ourSide === 'defense' ? defaultDefenseStrokes({ ...play, players, strokes: [] }) : [],
  }
}

export function setOurSide(play: Play, ourSide: Side): Play {
  if (ourSideOf(play) === ourSide) return { ...play, ourSide }
  const formed = applyFormation({ ...play, ourSide, showDefense: true }, play.format, play.formationId)
  const lined =
    ourSide === 'offense' && formed.showDefense ? { ...formed, strokes: defaultDefenseStrokes(formed) } : formed
  const category = categoryOf(play)
  if (ourSide === 'defense' && category === 'Pass play') return { ...lined, category: 'Defense' }
  if (ourSide === 'offense' && category === 'Defense') return { ...lined, category: 'Pass play' }
  return { ...lined, category }
}

export function setShowDefense(play: Play, show: boolean): Play {
  if (!show) return { ...play, showDefense: false }
  const other: Side = ourSideOf(play) === 'offense' ? 'defense' : 'offense'
  if (play.players.some((player) => player.side === other)) return { ...play, showDefense: true }
  const extra =
    other === 'defense'
      ? defenseFor(play.format, false, 6)
      : offenseFor(play.format, play.formationId, false, 0)
  const next = { ...play, showDefense: true, players: [...play.players, ...extra] }
  if (other !== 'defense') return next
  const added = new Set(extra.map((player) => player.id))
  return { ...next, strokes: [...play.strokes, ...defaultDefenseStrokes(next).filter((stroke) => added.has(stroke.playerId))] }
}

export function describeAssignment(player: Player, strokes: Stroke[]): string {
  const read = player.read ? `Read ${player.read}` : ''
  if (player.note.trim()) return read ? `${read}. ${player.note.trim()}` : player.note.trim()
  const parts: string[] = []
  const motion = strokes.find((stroke) => stroke.playerId === player.id && stroke.kind === 'motion')
  const main = strokes.find((stroke) => stroke.playerId === player.id && stroke.kind !== 'motion')
  if (motion) parts.push(motion.preset ? presetLabel(motion.preset) : 'Motion')
  if (main) parts.push(main.preset ? presetLabel(main.preset) : kindLabel(main.kind))
  if (read) parts.push(read.toLowerCase())
  return parts.join(' · ') || 'Check'
}

export function assignmentRows(play: Play): { label: string; detail: string }[] {
  return play.players
    .filter((player) => isPlayerShown(play, player))
    .map((player) => ({ label: player.label, detail: describeAssignment(player, play.strokes) }))
}

export function slug(name: string): string {
  const value = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return value || 'play'
}

export function offenseCount(play: Play): number {
  return play.players.filter((player) => player.side === 'offense').length
}

export function expectedOffense(format: FormatId): number {
  return FORMATS.find((item) => item.id === format)?.offense ?? 0
}

function coordsOf(value: unknown): Point | null {
  if (!value || typeof value !== 'object') return null
  const point = value as Point
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  return { x: point.x, y: point.y }
}

function asKind(value: unknown): StrokeKind | null {
  return value === 'route' || value === 'motion' || value === 'block' || value === 'run' ? value : null
}

export function sanitizePlay(input: unknown): Play | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Partial<Play>
  if (typeof raw.format !== 'string' || !isFormatId(raw.format)) return null
  if (!Array.isArray(raw.players) || raw.players.length === 0) return null
  const ourSide = raw.ourSide === 'defense' ? 'defense' : 'offense'
  const players: Player[] = []
  for (const item of raw.players) {
    if (!item || typeof item !== 'object') return null
    const player = item as Partial<Player>
    if (typeof player.id !== 'string' || typeof player.label !== 'string') return null
    const coords = coordsOf(player)
    if (!coords) return null
    if (player.side !== 'offense' && player.side !== 'defense') return null
    const role = player.role
    if (
      role !== 'qb' &&
      role !== 'center' &&
      role !== 'ol' &&
      role !== 'wr' &&
      role !== 'rb' &&
      role !== 'te' &&
      role !== 'fb' &&
      role !== 'dl' &&
      role !== 'lb' &&
      role !== 'db'
    ) {
      return null
    }
    const legacy = typeof player.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(player.color) ? player.color.toLowerCase() : ''
    const storedRoute = typeof player.routeColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(player.routeColor) ? player.routeColor : ''
    const routeColor = storedRoute || (legacy && legacy !== OUR_COLOR.toLowerCase() && legacy !== THEIR_COLOR.toLowerCase() ? legacy : routeColorAt(players.length))
    players.push({
      id: player.id,
      label: player.label.slice(0, 4),
      role,
      side: player.side,
      x: coords.x,
      y: coords.y,
      color: player.side === ourSide ? OUR_COLOR : THEIR_COLOR,
      routeColor,
      shape: shapeFor(role),
      read: typeof player.read === 'number' && player.read >= 1 && player.read <= 5 ? Math.round(player.read) : null,
      note: typeof player.note === 'string' ? player.note.slice(0, 180) : '',
    })
  }
  const ids = new Set(players.map((player) => player.id))
  const strokes: Stroke[] = []
  if (Array.isArray(raw.strokes)) {
    for (const item of raw.strokes) {
      if (!item || typeof item !== 'object') continue
      const stroke = item as Partial<Stroke>
      const kind = asKind(stroke.kind)
      if (!kind || typeof stroke.id !== 'string' || typeof stroke.playerId !== 'string') continue
      if (!ids.has(stroke.playerId) || !Array.isArray(stroke.points) || stroke.points.length < 2) continue
      const points = stroke.points.map(coordsOf)
      if (points.some((point) => point === null)) continue
      const curves = Array.isArray(stroke.curves) ? stroke.curves.map((curve) => coordsOf(curve)) : []
      while (curves.length < stroke.points.length - 1) curves.push(null)
      strokes.push({
        id: stroke.id,
        playerId: stroke.playerId,
        kind,
        points: points as Point[],
        curves: curves.slice(0, stroke.points.length - 1),
        preset: typeof stroke.preset === 'string' ? (stroke.preset as PresetId) : null,
        ...(typeof stroke.coverId === 'string' && ids.has(stroke.coverId) ? { coverId: stroke.coverId } : {}),
      })
    }
  }
  const now = Date.now()
  const format = raw.format
  const formationId = typeof raw.formationId === 'string' ? raw.formationId : formationById(format, '').id
  const play: Play = {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Imported play',
    formation: typeof raw.formation === 'string' && raw.formation.trim() ? raw.formation.trim().slice(0, 40) : formationById(format, formationId).name,
    formationId,
    format,
    los: typeof raw.los === 'number' ? Math.min(50, Math.max(1, Math.round(raw.los))) : DEFAULT_LOS,
    category: categoryOf({ category: typeof raw.category === 'string' ? raw.category : null, ourSide }),
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 600) : '',
    ourSide,
    showDefense: Boolean(raw.showDefense),
    players,
    strokes,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  }
  const stored = raw.origin ? sanitizePlay({ ...raw.origin, origin: undefined }) : null
  play.origin = stored ? withoutOrigin(stored) : withoutOrigin(play)
  return play
}

export interface ParsedBundle {
  kind: 'play' | 'playbook'
  name: string
  plays: Play[]
}

export function serializePlaybook(name: string, plays: Play[]): string {
  return JSON.stringify(
    { app: 'night-yard', version: 1, kind: 'playbook', name, exportedAt: new Date().toISOString(), plays },
    null,
    2,
  )
}

export function serializePlay(play: Play): string {
  return JSON.stringify({ app: 'night-yard', version: 1, kind: 'play', exportedAt: new Date().toISOString(), play }, null, 2)
}

export function parseBundle(text: string): ParsedBundle {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!data || typeof data !== 'object') throw new Error('That file is not a Night Yard play.')
  const bundle = data as { app?: string; version?: number; kind?: string; name?: string; play?: unknown; plays?: unknown }
  if (bundle.app !== 'night-yard' || bundle.version !== 1) {
    throw new Error('That file is not a Night Yard playbook.')
  }
  if (bundle.kind === 'play') {
    const play = sanitizePlay(bundle.play)
    if (!play) throw new Error('That play could not be read.')
    return { kind: 'play', name: play.name, plays: [play] }
  }
  if (bundle.kind === 'playbook' && Array.isArray(bundle.plays)) {
    const plays = bundle.plays.map(sanitizePlay).filter((play): play is Play => play !== null)
    if (plays.length === 0) throw new Error('That playbook has no readable plays.')
    return { kind: 'playbook', name: typeof bundle.name === 'string' && bundle.name.trim() ? bundle.name.trim() : 'Night Yard', plays }
  }
  throw new Error('That file is not a Night Yard playbook.')
}

export function mergePlays(existing: Play[], incoming: Play[]): Play[] {
  const map = new Map(existing.map((play) => [play.id, play]))
  for (const play of incoming) map.set(play.id, play)
  return [...map.values()]
}

export function snapshotAt(play: Play, t: number): Map<string, Point> {
  const positions = new Map<string, Point>()
  for (const player of play.players) positions.set(player.id, playerAtTime(player, play.strokes, t))
  return positions
}
