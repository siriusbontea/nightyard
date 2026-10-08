import { OUR_COLOR, THEIR_COLOR, defenseFor, formationById, offenseFor, routeColorAt, shapeFor } from './formations'
import { pointOnStroke } from './geometry'
import { canRedo, canUndo, commit, createHistory, redo, undo, type History } from './history'
import { uid } from './id'
import { playerAtTime } from './playback'
import { kindForPreset, kindLabel, makeStroke, presetFromPlayer, presetLabel } from './presets'
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
  return {
    id: options.id ?? uid(),
    name: options.name ?? 'New play',
    formation: formation.name,
    formationId: formation.id,
    format: options.format,
    los: 50,
    notes: '',
    ourSide: 'offense',
    showDefense: false,
    players: offenseFor(options.format, formation.id),
    strokes: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function showcasePlay(): Play {
  const play = createPlay({ format: '11v11', formationId: 'shotgun-trips', name: 'Stick' })
  play.notes = 'X stops on the hitch. Y takes the corner if the corner bails. Z runs the go. The back flares to the flat.'
  const byLabel = Object.fromEntries(play.players.map((player) => [player.label, player]))
  byLabel.X.read = 1
  byLabel.Y.read = 2
  byLabel.Z.read = 3
  const strokes: Stroke[] = []
  const add = (label: string, preset: PresetId, origin?: Point) => {
    const player = byLabel[label]
    strokes.push(makeStroke(uid(), player.id, preset, presetFromPlayer(preset, player, origin)))
  }
  add('X', 'hitch')
  add('Y', 'corner')
  add('Z', 'go')
  add('RB', 'out')
  play.strokes = strokes
  return play
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
    points: stroke.points.map((point) => ({ ...point })),
    curves: stroke.curves.map((curve) => (curve ? { ...curve } : null)),
  }))
  const now = Date.now()
  return {
    ...play,
    id: uid(),
    name: `${play.name} copy`,
    players,
    strokes,
    createdAt: now,
    updatedAt: now,
  }
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

export function replaceStroke(play: Play, stroke: Stroke): Play {
  return { ...play, strokes: play.strokes.map((item) => (item.id === stroke.id ? stroke : item)) }
}

export function deleteStroke(play: Play, strokeId: string): Play {
  return { ...play, strokes: play.strokes.filter((stroke) => stroke.id !== strokeId) }
}

export function clearPlayerStrokes(play: Play, playerId: string): Play {
  return { ...play, strokes: play.strokes.filter((stroke) => stroke.playerId !== playerId) }
}

export function applyPreset(play: Play, playerId: string, preset: PresetId): Play {
  const player = play.players.find((item) => item.id === playerId)
  if (!player) return play
  let origin: Point | undefined
  if (kindForPreset(preset) !== 'motion') {
    const motion = play.strokes.find((stroke) => stroke.playerId === playerId && stroke.kind === 'motion')
    if (motion) origin = pointOnStroke(motion, 1)
  }
  return setStroke(play, makeStroke(uid(), playerId, preset, presetFromPlayer(preset, player, origin)))
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
    strokes: [],
  }
}

export function setOurSide(play: Play, ourSide: Side): Play {
  if (ourSideOf(play) === ourSide) return { ...play, ourSide }
  return applyFormation({ ...play, ourSide, showDefense: true }, play.format, play.formationId)
}

export function setShowDefense(play: Play, show: boolean): Play {
  if (!show) return { ...play, showDefense: false }
  const other: Side = ourSideOf(play) === 'offense' ? 'defense' : 'offense'
  if (play.players.some((player) => player.side === other)) return { ...play, showDefense: true }
  const extra =
    other === 'defense'
      ? defenseFor(play.format, false, 6)
      : offenseFor(play.format, play.formationId, false, 0)
  return { ...play, showDefense: true, players: [...play.players, ...extra] }
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
      })
    }
  }
  const now = Date.now()
  const format = raw.format
  const formationId = typeof raw.formationId === 'string' ? raw.formationId : formationById(format, '').id
  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Imported play',
    formation: typeof raw.formation === 'string' && raw.formation.trim() ? raw.formation.trim().slice(0, 40) : formationById(format, formationId).name,
    formationId,
    format,
    los: typeof raw.los === 'number' ? Math.min(50, Math.max(1, Math.round(raw.los))) : 50,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 600) : '',
    ourSide,
    showDefense: Boolean(raw.showDefense),
    players,
    strokes,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  }
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
