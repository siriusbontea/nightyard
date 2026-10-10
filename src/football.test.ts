import { describe, expect, it } from 'vitest'
import { categoriesFor } from './categories'
import { defenseFor, formationsFor, specialDefense } from './formations'
import { FIELD_WIDTH, PLAYER_R } from './geometry'
import { applyFormation, createPlay, setOurSide, showcasePlay } from './play'
import { positionsFor } from './positions'
import { assignmentsFor, defenseLandmark, presetPath } from './presets'
import { FORMATS, type FormatId } from './types'

const FLAG: FormatId[] = ['5v5', '6v6', '7v7', '8v8', '9v9']
const SCRIMMAGE = ['trips-bunch', 'shotgun-trips', 'ace', 'i-form', 'punt', 'field-goal']

function onTheLine(y: number): boolean {
  return y > -0.85 && y < 0.5
}

describe('football alignments', () => {
  it('keeps every built-in lineup at the right count, inside the sidelines, and on the right side of the ball', () => {
    for (const format of FORMATS) {
      for (const formation of formationsFor(format.id)) {
        const play = createPlay({ format: format.id, formationId: formation.id })
        expect(play.players, formation.id).toHaveLength(format.offense)
        for (const player of play.players) {
          expect(player.x, `${formation.id} ${player.label}`).toBeGreaterThanOrEqual(PLAYER_R)
          expect(player.x, `${formation.id} ${player.label}`).toBeLessThanOrEqual(FIELD_WIDTH - PLAYER_R)
          expect(player.y, `${formation.id} ${player.label}`).toBeLessThanOrEqual(0.4)
          expect(player.label.length, player.label).toBeLessThanOrEqual(4)
        }
        const opp = specialDefense(formation.id)
        if (opp) {
          expect(opp).toHaveLength(format.offense)
          for (const player of defenseFor(format.id, false, 6, formation.id)) {
            expect(player.x, `opp ${player.label}`).toBeGreaterThanOrEqual(PLAYER_R)
            expect(player.x, `opp ${player.label}`).toBeLessThanOrEqual(FIELD_WIDTH - PLAYER_R)
          }
        }
      }
    }
  })

  it('puts seven on the line for 11v11 scrimmage, including punt and field goal', () => {
    for (const id of SCRIMMAGE) {
      const play = createPlay({ format: '11v11', formationId: id })
      const onLine = play.players.filter((player) => onTheLine(player.y))
      expect(onLine.length, id).toBeGreaterThanOrEqual(7)
    }
  })

  it('lines flag skill players up on the ball and keeps the quarterback off it', () => {
    for (const format of FLAG) {
      for (const formation of formationsFor(format)) {
        expect(formation.special, formation.id).toBeUndefined()
        const play = createPlay({ format, formationId: formation.id })
        for (const player of play.players) {
          if (player.role === 'qb') expect(player.y, player.label).toBeLessThan(-4)
          else expect(onTheLine(player.y), `${format} ${formation.id} ${player.label}`).toBe(true)
        }
      }
    }
    expect(formationsFor('11v11').map((formation) => formation.id)).toEqual([
      'trips-bunch',
      'shotgun-trips',
      'ace',
      'i-form',
      'kickoff',
      'kick-return',
      'punt',
      'punt-return',
      'field-goal',
      'fg-block',
    ])
  })

  it('makes the bunch and the I formation legal, and drops the shotgun slot off the line', () => {
    const bunch = createPlay({ format: '11v11', formationId: 'trips-bunch' })
    expect(bunch.players.find((player) => player.label === 'Y')!.y).toBeLessThan(-0.85)
    expect(bunch.players.find((player) => player.label === 'TE')!.y).toBeLessThan(-0.85)
    expect(onTheLine(bunch.players.find((player) => player.label === 'X')!.y)).toBe(true)
    const gun = createPlay({ format: '11v11', formationId: 'shotgun-trips' })
    expect(gun.players.find((player) => player.label === 'Y')!.y).toBeLessThan(-0.85)
    const eye = createPlay({ format: '11v11', formationId: 'i-form' })
    const qb = eye.players.find((player) => player.label === 'QB')!
    expect(qb.y).toBeGreaterThan(-2.5)
    expect(qb.y).toBeLessThan(-1)
    expect(eye.players.find((player) => player.label === 'Z')!.y).toBeLessThan(-0.85)
    expect(onTheLine(eye.players.find((player) => player.label === 'TE')!.y)).toBe(true)
    const corn = showcasePlay()
    expect(corn.players.find((player) => player.label === 'Y' && player.side === 'offense')!.y).toBeLessThan(-0.85)
    expect(corn.players.find((player) => player.label === 'TE')!.y).toBeLessThan(-0.85)
    const shovel = corn.strokes.find((stroke) => stroke.preset === 'run')!
    expect(shovel.points.at(-1)!.y).toBeGreaterThan(0)
  })

  it('draws a short slant, a hook under the curls, and an edge rush outside the tackle', () => {
    const slant = presetPath('slant', { x: 0, y: 0 }, 1)
    const stem = slant.points[1]
    const end = slant.points[2]
    expect(stem.y).toBeCloseTo(3)
    expect(end.y).toBeCloseTo(7)
    expect(end.x - stem.x).toBeCloseTo(end.y - stem.y)
    const hook = defenseLandmark('zone-hook', { id: '1', label: 'M', role: 'lb', side: 'defense', x: 20, y: 6, color: '', routeColor: '', shape: 'circle', read: null, note: '' }, 'left', 26)
    expect(hook.y).toBeGreaterThanOrEqual(10)
    const edge = defenseLandmark('blitz-edge', { id: '1', label: 'E', role: 'dl', side: 'defense', x: 18, y: 3, color: '', routeColor: '', shape: 'square', read: null, note: '' }, 'left', FIELD_WIDTH / 2)
    expect(Math.abs(edge.x - FIELD_WIDTH / 2)).toBeCloseTo(11)
    expect(edge.y).toBeLessThan(0)
  })

  it('offers routes only to offense, rushes first to linemen, and kicking jobs on a kicking play', () => {
    const play = createPlay({ format: '11v11', formationId: 'shotgun-trips' })
    const wr = play.players.find((player) => player.label === 'X')!
    const shown = setOurSide(setOurSide(play, 'defense'), 'offense')
    const dl = shown.players.find((player) => player.role === 'dl')!
    expect(assignmentsFor(wr).map((job) => job.id)).toContain('slant')
    expect(assignmentsFor(wr).map((job) => job.id)).toContain('block')
    expect(assignmentsFor(wr).map((job) => job.id)).not.toContain('blitz-a')
    expect(assignmentsFor(dl)[0].id).toBe('blitz-a')
    expect(assignmentsFor(dl).map((job) => job.id)).not.toContain('slant')
    const kick = createPlay({ format: '11v11', formationId: 'kickoff' })
    const k = kick.players.find((player) => player.label === 'K')!
    expect(assignmentsFor(k, true).map((job) => job.id)).toEqual(['kick', 'cover'])
    expect(assignmentsFor(k, true).map((job) => job.id)).not.toContain('slant')
    const block = createPlay({ format: '11v11', formationId: 'fg-block' })
    const nose = block.players.find((player) => player.role === 'dl')!
    expect(assignmentsFor(nose, true)[0].id).toBe('rush-kick')
    expect(kick.category).toBe('Special teams')
    expect(kick.strokes.some((stroke) => stroke.preset === 'kick')).toBe(true)
    expect(kick.strokes.some((stroke) => stroke.preset === 'cover')).toBe(true)
    const back = applyFormation(kick, '5v5', 'doubles')
    expect(back.category).toBe('Pass play')
    expect(back.formationId).toBe('doubles')
  })

  it('hides special teams on flag and keeps offense and defense position lists apart', () => {
    expect(categoriesFor('5v5')).not.toContain('Special teams')
    expect(categoriesFor('9v9')).not.toContain('Special teams')
    expect(categoriesFor('11v11')).toContain('Special teams')
    for (const format of FORMATS) {
      const offense = positionsFor(format.id, 'offense').map((option) => option.label)
      const defense = positionsFor(format.id, 'defense').map((option) => option.label)
      expect(offense.filter((label) => defense.includes(label))).toEqual([])
      if (format.id !== '11v11') {
        expect(offense).not.toContain('K')
        expect(offense).not.toContain('TE')
        expect(defense).not.toContain('QB')
      }
    }
    const cover = setOurSide(createPlay({ format: '11v11', formationId: 'shotgun-trips' }), 'defense')
    const byLabel = Object.fromEntries(cover.players.map((player) => [player.label, player.id]))
    const presetOf = (label: string) => cover.strokes.find((stroke) => stroke.playerId === byLabel[label])?.preset
    expect(presetOf('LC')).toBe('zone-third')
    expect(presetOf('RC')).toBe('zone-third')
    expect(presetOf('FS')).toBe('zone-middle')
    expect(presetOf('SS')).toBe('zone-hook')
    expect(cover.strokes.some((stroke) => stroke.preset === 'zone-half')).toBe(false)
    expect(presetOf('E')).toBe('blitz-edge')
  })
})
