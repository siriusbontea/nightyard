import { describe, expect, it } from 'vitest'
import { canUndo, commit, createHistory, redo, undo } from './history'
import { MOTION_SPLIT, playerAtTime } from './playback'
import { applyPosition } from './positions'
import {
  applyFormation,
  applyMan,
  applyPreset,
  defaultBreakSide,
  flipPlay,
  mainStroke,
  mirrorPlayerRoutes,
  presetOnPlayer,
  removeRoute,
  presetOrigin,
  isPlayerShown,
  setOurSide,
  setShowDefense,
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
import { EXPORT_CAMERA, FIELD_WIDTH, PLAYER_R } from './geometry'
import { assignmentsFor, presetFromPlayer, presetPath } from './presets'
import { fieldMarkup } from './fieldMarkup'
import { NIGHT, PRINT } from './theme'
import { renderExportSvg } from './exportSvg'
import { categoryOf, groupPlays } from './categories'
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
    const ballX = FIELD_WIDTH - 20
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

  it('starts on 11v11 tackle at the 3 with a bunch, a walk-in, and both teams', () => {
    const play = showcasePlay()
    expect(play.format).toBe('11v11')
    expect(play.formationId).toBe('trips-bunch')
    expect(play.formation).toBe('Trips Bunch')
    expect(play.los).toBe(3)
    expect(play.ourSide).toBe('offense')
    expect(play.showDefense).toBe(true)
    expect(play.name).toBe('Corndog')
    expect(play.players.filter((player) => player.side === 'offense')).toHaveLength(11)
    expect(play.players.filter((player) => player.side === 'defense')).toHaveLength(11)
    expect(play.players.filter((player) => player.side === 'offense').every((player) => player.color === OUR_COLOR)).toBe(true)
    expect(play.players.filter((player) => player.side === 'defense').every((player) => player.color === THEIR_COLOR)).toBe(true)
    const x = play.players.find((player) => player.label === 'X')!
    expect(x.read).toBe(1)
    expect(play.strokes.some((stroke) => stroke.playerId === x.id && stroke.kind === 'motion')).toBe(true)
    expect(play.strokes.some((stroke) => stroke.preset === 'corner')).toBe(true)
    expect(play.strokes.some((stroke) => stroke.curves.some(Boolean))).toBe(true)
    const banned = /super bowl|chiefs|49ers|mahomes|hardman/i
    expect(JSON.stringify(play)).not.toMatch(banned)
    for (const player of play.players) {
      expect(player.x, player.label).toBeGreaterThanOrEqual(PLAYER_R)
      expect(player.x, player.label).toBeLessThanOrEqual(FIELD_WIDTH - PLAYER_R)
    }
    const columns = [12, FIELD_WIDTH - 12]
    for (const stroke of play.strokes) {
      const samples = [...stroke.points, ...stroke.curves.filter((point): point is { x: number; y: number } => point !== null)]
      for (const point of samples) {
        for (const column of columns) {
          expect(Math.abs(point.x - column), stroke.preset ?? stroke.kind).toBeGreaterThan(2.2)
        }
      }
    }
  })

  it('shows the path already on a player, and previews the same line the field draws', () => {
    const play = showcasePlay()
    const x = play.players.find((player) => player.label === 'X')!
    expect(presetOnPlayer(play, x.id)).toBe('motion')
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
    expect(restored.name).toBe('Corndog')
    expect(restored.format).toBe('11v11')
    expect(restored.los).toBe(3)
    expect(restored.ourSide).toBe('offense')
    expect(restored.players.filter((item) => item.side === 'offense').every((item) => item.color === OUR_COLOR)).toBe(true)
    expect(restored.players.filter((item) => item.side === 'defense').every((item) => item.color === THEIR_COLOR)).toBe(true)
    expect(restored.strokes.some((stroke) => stroke.kind === 'motion')).toBe(true)
    expect(restored.strokes.some((stroke) => stroke.preset === 'corner')).toBe(true)
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
    expect(savedStart.los).toBe(30)
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
    expect(eleven.los).toBe(3)
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
    expect(assignmentRows(play).some((row) => row.label === 'X' && /motion/i.test(row.detail))).toBe(true)
  })

  it('keeps a saved line and puts a missing line on the 30', () => {
    const play = createPlay({ format: '5v5', formationId: 'doubles', name: 'Flag mesh' })
    play.los = 15
    const packed = JSON.parse(serializePlay(play)) as { play: { los?: number; format: string } }
    const kept = parseBundle(JSON.stringify(packed)).plays[0]
    expect(kept.los).toBe(15)
    expect(kept.format).toBe('5v5')
    expect(sanitizePlay({ ...packed.play, los: 15 })?.los).toBe(15)
    delete packed.play.los
    expect(parseBundle(JSON.stringify(packed)).plays[0].los).toBe(30)
  })

  it('paints your team orange and the other team lime, and starts on the 30', () => {
    const play = createPlay({ format: '11v11', formationId: 'i-form' })
    expect(play.los).toBe(30)
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

  it('replaces a run with a block instead of stacking both', () => {
    const play = showcasePlay()
    const back = play.players.find((player) => player.label === 'RB')!
    expect(mainStroke(play, back.id)?.kind).toBe('run')
    const next = applyPreset(play, back.id, 'block')
    const lines = next.strokes.filter((stroke) => stroke.playerId === back.id)
    expect(lines).toHaveLength(1)
    expect(lines[0].kind).toBe('block')
    expect(lines[0].preset).toBe('block')
    const gone = removeRoute(next, back.id)
    expect(gone.strokes.some((stroke) => stroke.playerId === back.id)).toBe(false)
  })

  it('keeps jet motion when the route after it changes', () => {
    const play = showcasePlay()
    const x = play.players.find((player) => player.label === 'X')!
    const next = applyPreset(play, x.id, 'slant', 'left')
    expect(next.strokes.filter((stroke) => stroke.playerId === x.id && stroke.kind === 'motion')).toHaveLength(1)
    const slant = mainStroke(next, x.id)!
    expect(slant.preset).toBe('slant')
    expect(slant.points.at(-1)!.x).toBeLessThan(slant.points[0].x)
  })

  it('mirrors one player and the whole play, and leaves a go route straight', () => {
    const play = createPlay({ format: '11v11', formationId: 'shotgun-trips', name: 'Stick' })
    const y = play.players.find((player) => player.label === 'Y')!
    const withSlant = applyPreset(play, y.id, 'slant', 'right')
    const flipped = mirrorPlayerRoutes(withSlant, y.id)
    const before = mainStroke(withSlant, y.id)!
    const after = mainStroke(flipped, y.id)!
    expect(after.points.at(-1)!.x).toBeLessThan(before.points[0].x)
    expect(after.points[0].x).toBeCloseTo(y.x)
    const z = play.players.find((player) => player.label === 'Z')!
    const withGo = applyPreset(play, z.id, 'go')
    const stillGo = mirrorPlayerRoutes(withGo, z.id)
    expect(mainStroke(stillGo, z.id)!.points[1].x).toBeCloseTo(z.x)
    const mirrored = flipPlay(withSlant)
    expect(mirrored.players.find((player) => player.id === y.id)!.x).toBeCloseTo(FIELD_WIDTH - y.x)
    expect(mainStroke(mirrored, y.id)!.points[0].x).toBeCloseTo(FIELD_WIDTH - before.points[0].x)
  })

  it('starts Corndog and Stick as pass plays, and a defense look as Defense', () => {
    expect(categoryOf(showcasePlay())).toBe('Pass play')
    expect(categoryOf(createPlay({ format: '11v11', name: 'Stick' }))).toBe('Pass play')
    expect(defaultBreakSide(10)).toBe('right')
    expect(defaultBreakSide(FIELD_WIDTH - 4)).toBe('left')
    const defense = setOurSide(createPlay({ format: '11v11', name: 'Cover 3' }), 'defense')
    expect(categoryOf(defense)).toBe('Defense')
    const old = sanitizePlay({ ...JSON.parse(serializePlay(showcasePlay())).play, category: undefined })
    expect(old && categoryOf(old)).toBe('Pass play')
    const labeled = sanitizePlay({ ...JSON.parse(serializePlay(showcasePlay())).play, category: 'Trick play' })
    expect(labeled && categoryOf(labeled)).toBe('Trick play')
    const groups = groupPlays([showcasePlay(), defense], 'All')
    expect(groups.map((group) => group.category)).toEqual(['Pass play', 'Defense'])
  })

  it('gives defenders zone and rush jobs, and leaves Corndog routes alone', () => {
    const offense = createPlay({ format: '11v11', name: 'Stick' })
    const wr = offense.players.find((player) => player.role === 'wr')!
    const wrJobs = assignmentsFor(wr).map((job) => job.id)
    expect(wrJobs).toContain('slant')
    expect(wrJobs).toContain('block')
    expect(wrJobs).not.toContain('zone-third')

    const shown = setShowDefense(offense, true)
    expect(shown.ourSide).toBe('offense')
    const lime = shown.players.find((player) => player.side === 'defense' && player.role === 'db')!
    const dl = shown.players.find((player) => player.side === 'defense' && player.role === 'dl')!
    expect(assignmentsFor(lime).map((job) => job.id)).not.toContain('slant')
    expect(assignmentsFor(lime).map((job) => job.id)).toContain('zone-half')
    expect(assignmentsFor(dl)[0].id).toBe('blitz-a')
    expect(shown.strokes.some((stroke) => stroke.preset === 'blitz-a' || stroke.preset === 'blitz-b' || stroke.preset === 'blitz-edge')).toBe(true)
    expect(shown.strokes.some((stroke) => stroke.preset?.startsWith('zone-'))).toBe(true)
    expect(shown.strokes.some((stroke) => stroke.preset === 'slant' || stroke.preset === 'go' || stroke.preset === 'post')).toBe(false)

    const corn = showcasePlay()
    expect(setShowDefense(corn, true).strokes).toHaveLength(corn.strokes.length)
    expect(corn.strokes.some((stroke) => stroke.preset === 'zone-third')).toBe(false)

    const defense = setOurSide(createPlay({ format: '11v11', name: 'Cover 3' }), 'defense')
    expect(defense.strokes.some((stroke) => stroke.preset === 'blitz-edge' || stroke.preset === 'blitz-a')).toBe(true)
    expect(defense.strokes.some((stroke) => stroke.preset === 'zone-third' || stroke.preset === 'zone-half' || stroke.preset === 'zone-hook')).toBe(true)
    const back = setOurSide(defense, 'offense')
    expect(back.ourSide).toBe('offense')
    const limeJobs = back.strokes.filter((stroke) => back.players.find((player) => player.id === stroke.playerId)?.side === 'defense')
    expect(limeJobs.some((stroke) => stroke.preset === 'blitz-a' || stroke.preset === 'blitz-edge')).toBe(true)
    expect(limeJobs.some((stroke) => stroke.preset?.startsWith('zone-'))).toBe(true)
    expect(limeJobs.some((stroke) => stroke.preset === 'slant' || stroke.preset === 'go')).toBe(false)

    const left = presetFromPlayer('zone-third', lime, undefined, -1, 20)
    const right = presetFromPlayer('zone-third', lime, undefined, 1, 20)
    expect(left.points[1].x).toBeLessThan(right.points[1].x)
    const rush = applyPreset(shown, dl.id, 'blitz-a', 'left')
    expect(mainStroke(rush, dl.id)!.points.at(-1)!.y).toBeLessThan(0)

    const wrTarget = shown.players.find((player) => player.side === 'offense' && player.role === 'wr')!
    const man = applyMan(shown, lime.id, wrTarget.id)
    expect(mainStroke(man, lime.id)?.preset).toBe('man')
    expect(mainStroke(man, lime.id)?.coverId).toBe(wrTarget.id)

    const zoned = applyPreset(shown, lime.id, 'zone-third', 'left')
    const color = fieldMarkup({ play: zoned, camera: EXPORT_CAMERA, theme: NIGHT })
    expect(color).toContain('data-preset="zone-third"')
    expect(color).toContain('data-zone="1"')
    expect(color).toContain('<ellipse')
    const printed = fieldMarkup({ play: zoned, camera: EXPORT_CAMERA, theme: PRINT })
    expect(printed).toMatch(/<ellipse[^>]*fill="none"/)
    expect(printed).toMatch(/<ellipse[^>]*stroke="#111111"/)
    const blitzSvg = fieldMarkup({ play: rush, camera: EXPORT_CAMERA, theme: NIGHT })
    const blitz = blitzSvg.split('data-preset="blitz-a"')[1]?.slice(0, 900) ?? ''
    expect(blitz).toContain(' Z')
    expect(blitz).not.toContain('<ellipse')
    const manSvg = fieldMarkup({ play: man, camera: EXPORT_CAMERA, theme: NIGHT })
    expect(manSvg).toContain('data-preset="man"')
    expect(manSvg).toContain('stroke-dasharray')
    expect(renderExportSvg(corn, 'print')).toContain('Pass play')
  })
})
