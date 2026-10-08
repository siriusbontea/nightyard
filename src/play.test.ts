import { describe, expect, it } from 'vitest'
import { canUndo, commit, createHistory, redo, undo } from './history'
import { MOTION_SPLIT, playerAtTime } from './playback'
import { applyPosition } from './positions'
import {
  applyFormation,
  applyPreset,
  presetOnPlayer,
  presetOrigin,
  isPlayerShown,
  setOurSide,
  updatePlayer,
  assignmentRows,
  createPlay,
  describeAssignment,
  duplicatePlay,
  mergePlays,
  offenseCount,
  parseBundle,
  renamePlay,
  resetPlay,
  sanitizePlay,
  serializePlay,
  serializePlaybook,
  showcasePlay,
  translatePlayer,
} from './play'
import { OUR_COLOR, THEIR_COLOR, defenseFor, formationsFor } from './formations'
import { FIELD_WIDTH, PLAYER_R } from './geometry'
import { presetFromPlayer, presetPath } from './presets'
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

  it('centers the center and quarterback on the ball and keeps every alignment inside the sidelines', () => {
    const midfield = FIELD_WIDTH / 2
    for (const format of FORMATS) {
      for (const formation of formationsFor(format.id)) {
        const play = createPlay({ format: format.id, formationId: formation.id, name: formation.name })
        const center = play.players.find((player) => player.role === 'center')
        const qb = play.players.find((player) => player.role === 'qb')
        expect(center?.x, `${format.id} ${formation.id} center`).toBeCloseTo(midfield, 5)
        expect(qb?.x, `${format.id} ${formation.id} quarterback`).toBeCloseTo(midfield, 5)
        for (const player of play.players) {
          expect(player.x, `${format.id} ${player.label}`).toBeGreaterThanOrEqual(PLAYER_R)
          expect(player.x, `${format.id} ${player.label}`).toBeLessThanOrEqual(FIELD_WIDTH - PLAYER_R)
        }
      }
      for (const player of defenseFor(format.id)) {
        expect(player.x, `${format.id} defense ${player.label}`).toBeGreaterThanOrEqual(PLAYER_R)
        expect(player.x, `${format.id} defense ${player.label}`).toBeLessThanOrEqual(FIELD_WIDTH - PLAYER_R)
      }
    }

    const starter = showcasePlay()
    const ballX = midfield
    const center = starter.players.find((player) => player.role === 'center')!
    expect(Math.abs(center.x - ballX)).toBeLessThan(0.05)
    for (const stroke of starter.strokes) {
      const samples = [...stroke.points, ...stroke.curves.filter((point): point is { x: number; y: number } => point !== null)]
      for (const point of samples) {
        expect(point.x, stroke.preset ?? stroke.kind).toBeGreaterThan(0.5)
        expect(point.x, stroke.preset ?? stroke.kind).toBeLessThan(FIELD_WIDTH - 0.5)
      }
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

  it('starts on 11v11 tackle at the 50 with routes that miss the yard numbers', () => {
    const play = showcasePlay()
    expect(play.format).toBe('11v11')
    expect(play.formationId).toBe('shotgun-trips')
    expect(play.los).toBe(50)
    expect(play.ourSide).toBe('offense')
    expect(play.name).toBe('Stick')
    expect(play.players.filter((player) => player.side === 'offense')).toHaveLength(11)
    expect(play.players.every((player) => player.color === OUR_COLOR)).toBe(true)
    expect(play.strokes.map((stroke) => stroke.preset).sort()).toEqual(['corner', 'go', 'hitch', 'out'])
    expect(play.strokes.some((stroke) => stroke.curves.some(Boolean))).toBe(true)
    expect(play.players.find((player) => player.label === 'X')?.read).toBe(1)
    const columns = [12, FIELD_WIDTH - 12]
    for (const stroke of play.strokes) {
      const samples = [...stroke.points, ...stroke.curves.filter((point): point is { x: number; y: number } => point !== null)]
      for (const point of samples) {
        for (const column of columns) {
          expect(Math.abs(point.x - column), stroke.preset ?? '').toBeGreaterThan(2.2)
        }
      }
    }
  })

  it('shows the path already on a player, and previews the same line the field draws', () => {
    const play = showcasePlay()
    const x = play.players.find((player) => player.label === 'X')!
    expect(presetOnPlayer(play, x.id)).toBe('hitch')
    const fresh = createPlay({ format: '11v11', formationId: 'shotgun-trips' })
    const y = fresh.players.find((player) => player.label === 'Y')!
    const withMotion = applyPreset(fresh, y.id, 'motion')
    const next = applyPreset(withMotion, y.id, 'wheel')
    const drawn = next.strokes.find((stroke) => stroke.preset === 'wheel')!
    const preview = presetFromPlayer('wheel', y, presetOrigin(withMotion, y.id, 'wheel'))
    expect(preview.points).toEqual(drawn.points)
    expect(preview.curves).toEqual(drawn.curves)
  })

  it('puts this play back to how it started and leaves the other plays alone', () => {
    const start = showcasePlay()
    const player = start.players.find((item) => item.label === 'X')!
    const edited = translatePlayer({ ...start, los: 20, name: 'Moved' }, player.id, player.x + 3, player.y - 1)
    const restored = resetPlay(edited)
    expect(restored.id).toBe(start.id)
    expect(restored.name).toBe('Stick')
    expect(restored.format).toBe('11v11')
    expect(restored.los).toBe(50)
    expect(restored.ourSide).toBe('offense')
    expect(restored.players.every((item) => item.color === OUR_COLOR)).toBe(true)
    expect(restored.strokes.map((stroke) => stroke.preset).sort()).toEqual(['corner', 'go', 'hitch', 'out'])
    expect(restored.players.find((item) => item.label === 'X')?.x).toBeCloseTo(player.x)
    const other = createPlay({ format: '5v5', formationId: 'doubles', name: 'Flag mesh' })
    const book = [restored, other]
    expect(book[1]).toBe(other)
    expect(book[1].name).toBe('Flag mesh')
    const history = createHistory(restored)
    expect(canUndo(history)).toBe(false)
    const old = createPlay({ format: '7v7', formationId: 'spread', name: 'Flood' })
    delete old.origin
    const remembered = { ...old, origin: undefined }
    const savedStart = resetPlay({ ...remembered, name: 'Flood edit', los: 10, origin: old })
    expect(savedStart.name).toBe('Flood')
    expect(savedStart.los).toBe(50)
    expect(savedStart.id).toBe(old.id)
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
    expect(eleven.los).toBe(50)
    const onTheTwenty = applyFormation({ ...play, los: 25 }, '5v5', 'doubles')
    expect(onTheTwenty.los).toBe(25)
    expect(setOurSide(onTheTwenty, 'defense').los).toBe(25)
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
    expect(describeAssignment(z, play.strokes)).toMatch(/go/i)
    const noted = { ...z, note: 'Sit if the flat is taken' }
    expect(describeAssignment(noted, play.strokes)).toContain('Sit if the flat is taken')
    expect(assignmentRows(play).some((row) => row.label === 'X' && /hitch/i.test(row.detail))).toBe(true)
  })

  it('keeps a saved line and puts a missing line on the 50', () => {
    const play = createPlay({ format: '5v5', formationId: 'doubles', name: 'Flag mesh' })
    play.los = 15
    const packed = JSON.parse(serializePlay(play)) as { play: { los?: number; format: string } }
    const kept = parseBundle(JSON.stringify(packed)).plays[0]
    expect(kept.los).toBe(15)
    expect(kept.format).toBe('5v5')
    expect(sanitizePlay({ ...packed.play, los: 15 })?.los).toBe(15)
    delete packed.play.los
    expect(parseBundle(JSON.stringify(packed)).plays[0].los).toBe(50)
  })

  it('paints your team orange and the other team lime, and starts on the 50', () => {
    const play = createPlay({ format: '11v11', formationId: 'i-form' })
    expect(play.los).toBe(50)
    expect(play.ourSide).toBe('offense')
    expect(play.players.every((player) => player.color === OUR_COLOR)).toBe(true)
    expect(new Set(play.players.map((player) => player.routeColor)).size).toBe(play.players.length)
    const defending = setOurSide(play, 'defense')
    expect(defending.players.filter((player) => player.side === 'defense')).toHaveLength(11)
    expect(defending.players.filter((player) => player.side === 'defense').every((player) => player.color === OUR_COLOR)).toBe(true)
    expect(defending.players.filter((player) => player.side === 'offense').every((player) => player.color === THEIR_COLOR)).toBe(true)
    expect(defending.showDefense).toBe(true)
    const ours = defending.players.find((player) => player.side === 'defense')!
    const theirs = defending.players.find((player) => player.side === 'offense')!
    const hidden = { ...defending, showDefense: false }
    expect(isPlayerShown(hidden, ours)).toBe(true)
    expect(isPlayerShown(hidden, theirs)).toBe(false)
  })

  it('keeps a saved route color when an older play had a position color', () => {
    const play = createPlay({ format: '5v5', formationId: 'doubles' })
    const packed = JSON.parse(serializePlay(play)) as { play: { ourSide?: string; players: { color: string; routeColor?: string }[] } }
    delete packed.play.ourSide
    delete packed.play.players[0].routeColor
    packed.play.players[0].color = '#38bdf8'
    const loaded = parseBundle(JSON.stringify(packed)).plays[0]
    expect(loaded.ourSide).toBe('offense')
    expect(loaded.players[0].color).toBe(OUR_COLOR)
    expect(loaded.players[0].routeColor).toBe('#38bdf8')
    expect(loaded.players).toHaveLength(play.players.length)
  })

  it('swaps a fullback for a second tight end without changing the count, and undo puts the fullback back', () => {
    const play = createPlay({ format: '11v11', formationId: 'i-form' })
    const fb = play.players.find((player) => player.label === 'FB')!
    const next = updatePlayer(play, fb.id, applyPosition(play, fb, 'te'))
    expect(next.players).toHaveLength(11)
    const swapped = next.players.find((player) => player.id === fb.id)!
    expect(swapped.label).toBe('TE2')
    expect(swapped.role).toBe('te')
    expect(swapped.shape).toBe('circle')
    expect(swapped.side).toBe('offense')
    const restored = undo(commit(createHistory(play), next))
    expect(restored.present.players.find((player) => player.id === fb.id)?.label).toBe('FB')
    expect(redo(restored).present.players.find((player) => player.id === fb.id)?.label).toBe('TE2')
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
    color: '#f0c14a',
    routeColor: '#38bdf8',
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
