import { describe, expect, it } from 'vitest'
import { commit, createHistory, redo, undo } from './history'
import { MOTION_SPLIT, playerAtTime } from './playback'
import {
  applyFormation,
  applyPreset,
  assignmentRows,
  createPlay,
  describeAssignment,
  duplicatePlay,
  mergePlays,
  offenseCount,
  parseBundle,
  renamePlay,
  serializePlay,
  serializePlaybook,
  showcasePlay,
  translatePlayer,
} from './play'
import { presetPath } from './presets'
import { FORMATS, type Player, type Stroke } from './types'

describe('play model', () => {
  it('builds every American format and refuses a 12th player set', () => {
    expect(FORMATS.map((format) => format.id)).toEqual(['5v5', '6v6', '7v7', '8v8', '9v9', '11v11'])
    expect(FORMATS.some((format) => format.id === ('12v12' as '5v5'))).toBe(false)
    for (const format of FORMATS) {
      const play = createPlay({ format: format.id, name: format.label })
      expect(offenseCount(play)).toBe(format.offense)
      expect(play.players.filter((player) => player.side === 'defense')).toHaveLength(0)
    }
  })

  it('draws the quarterback as a diamond and the center as a square', () => {
    const play = createPlay({ format: '11v11', formationId: 'shotgun-trips' })
    const qb = play.players.find((player) => player.label === 'QB')
    const center = play.players.find((player) => player.label === 'C')
    expect(qb?.shape).toBe('diamond')
    expect(center?.shape).toBe('square')
    expect(play.players.filter((player) => player.role === 'ol').every((player) => player.shape === 'square')).toBe(true)
  })

  it('gives the starter a slant, a curved corner, motion, and a block', () => {
    const play = showcasePlay()
    const kinds = play.strokes.map((stroke) => stroke.kind).sort()
    expect(kinds).toEqual(['block', 'motion', 'route', 'route', 'route'])
    expect(play.strokes.some((stroke) => stroke.preset === 'slant')).toBe(true)
    expect(play.strokes.some((stroke) => stroke.curves.some(Boolean))).toBe(true)
    expect(play.players.find((player) => player.label === 'Z')?.read).toBe(1)
  })

  it('duplicates with fresh ids that strokes still point at', () => {
    const play = showcasePlay()
    const copy = duplicatePlay(play)
    expect(copy.id).not.toBe(play.id)
    expect(copy.name).toContain('copy')
    const oldIds = new Set(play.players.map((player) => player.id))
    expect(copy.players.every((player) => !oldIds.has(player.id))).toBe(true)
    const newIds = new Set(copy.players.map((player) => player.id))
    expect(copy.strokes.every((stroke) => newIds.has(stroke.playerId))).toBe(true)
  })

  it('renames, moves a player with their route, and undoes both', () => {
    let history = createHistory(createPlay({ format: '5v5', formationId: 'doubles', name: 'Mesh' }))
    const player = history.present.players.find((item) => item.label === 'X')!
    history = commit(history, applyPreset(history.present, player.id, 'slant'))
    const renamed = commit(history, renamePlay(history.present, 'Mesh Left'))
    expect(renamed.present.name).toBe('Mesh Left')
    const moved = commit(renamed, translatePlayer(renamed.present, player.id, player.x + 2, player.y - 1))
    const route = moved.present.strokes.find((stroke) => stroke.playerId === player.id)!
    expect(route.points[0].x).toBeCloseTo(player.x + 2)
    expect(route.points[0].y).toBeCloseTo(player.y - 1)
    const undone = undo(moved)
    expect(undone.present.players.find((item) => item.id === player.id)?.x).toBeCloseTo(player.x)
    expect(redo(undone).present.players.find((item) => item.id === player.id)?.x).toBeCloseTo(player.x + 2)
  })

  it('replaces a route of the same kind and resets personnel on a new format', () => {
    const play = showcasePlay()
    const z = play.players.find((player) => player.label === 'Z')!
    const next = applyPreset(play, z.id, 'go')
    const zRoutes = next.strokes.filter((stroke) => stroke.playerId === z.id && stroke.kind === 'route')
    expect(zRoutes).toHaveLength(1)
    expect(zRoutes[0].preset).toBe('go')
    const eleven = applyFormation(play, '11v11', 'shotgun-trips')
    expect(offenseCount(eleven)).toBe(11)
    expect(eleven.strokes).toHaveLength(0)
    expect(eleven.formation).toBe('Shotgun Trips')
  })

  it('round-trips JSON and rejects a Canadian 12-player file', () => {
    const play = showcasePlay()
    const parsed = parseBundle(serializePlay(play))
    expect(parsed.kind).toBe('play')
    expect(parsed.plays[0].name).toBe(play.name)
    expect(parsed.plays[0].strokes).toHaveLength(play.strokes.length)
    const book = parseBundle(serializePlaybook('Friday', [play]))
    expect(book.kind).toBe('playbook')
    expect(book.name).toBe('Friday')
    expect(mergePlays([{ ...play, name: 'Old' }], parsed.plays)[0].name).toBe(play.name)
    expect(() =>
      parseBundle(
        JSON.stringify({
          app: 'night-yard',
          version: 1,
          kind: 'play',
          play: { format: '12v12', players: [{ id: 'a', label: 'QB', side: 'offense', role: 'qb', x: 1, y: 1 }] },
        }),
      ),
    ).toThrow(/not a Night Yard|could not be read/)
  })

  it('describes assignments from the route, then prefers a written note', () => {
    const play = showcasePlay()
    const z = play.players.find((player) => player.label === 'Z')!
    expect(describeAssignment(z, play.strokes)).toMatch(/slant/i)
    const noted = { ...z, note: 'Sit if the flat is taken' }
    expect(describeAssignment(noted, play.strokes)).toContain('Sit if the flat is taken')
    expect(assignmentRows(play).some((row) => row.label === 'C' && /block/i.test(row.detail))).toBe(true)
  })
})

describe('playback', () => {
  const player = {
    id: 'y',
    label: 'Y',
    role: 'wr',
    side: 'offense',
    x: 10,
    y: 0,
    color: '#d6f25a',
    shape: 'circle',
    read: null,
    note: '',
  } satisfies Player

  function line(id: string, kind: Stroke['kind'], points: Stroke['points']): Stroke {
    return { id, playerId: player.id, kind, points, curves: points.slice(1).map(() => null), preset: null }
  }

  it('runs motion before the snap, then the route from the motion spot', () => {
    const motion = line('m', 'motion', [
      { x: 10, y: 0 },
      { x: 16, y: 0 },
    ])
    const route = line('r', 'route', [
      { x: 16, y: 0 },
      { x: 16, y: 10 },
    ])
    expect(playerAtTime(player, [motion, route], 0)).toEqual({ x: 10, y: 0 })
    const atSnap = playerAtTime(player, [motion, route], MOTION_SPLIT)
    expect(atSnap.x).toBeCloseTo(16, 0)
    expect(atSnap.y).toBeCloseTo(0, 0)
    const done = playerAtTime(player, [motion, route], 1)
    expect(done.x).toBeCloseTo(16, 0)
    expect(done.y).toBeCloseTo(10, 0)
  })

  it('follows a lone route across the whole timeline', () => {
    const route = line('r', 'route', presetPath('go', { x: 10, y: 0 }, 1).points)
    expect(playerAtTime(player, [route], 0)).toEqual({ x: 10, y: 0 })
    expect(playerAtTime(player, [route], 1).y).toBeCloseTo(15, 0)
  })

  it('bridges a route that still starts on the alignment after motion', () => {
    const motion = line('m', 'motion', [
      { x: 10, y: 0 },
      { x: 16, y: 0 },
    ])
    const route = line('r', 'route', [
      { x: 10, y: 0 },
      { x: 10, y: 12 },
    ])
    const justAfter = playerAtTime(player, [motion, route], MOTION_SPLIT + 0.01)
    expect(justAfter.x).toBeGreaterThan(14)
  })
})
