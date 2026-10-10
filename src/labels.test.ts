import { describe, expect, it } from 'vitest'
import { migrateBuiltinLabels } from './labels'
import { sanitizePlay } from './play'
import type { Player } from './types'

function person(label: string, role: Player['role'], side: Player['side'], x: number): Player {
  return {
    id: label,
    label,
    role,
    side,
    x,
    y: 0,
    color: '#f0c14a',
    routeColor: '#38bdf8',
    shape: 'circle',
    read: null,
    note: '',
  }
}

describe('built-in label migration', () => {
  it('renames old default letters and leaves a custom name alone', () => {
    const players = [
      person('Z', 'wr', 'offense', 6),
      person('X', 'wr', 'offense', 40),
      person('Y', 'te', 'offense', 36),
      person('Slot', 'wr', 'offense', 20),
      person('E', 'dl', 'defense', 18),
      person('N', 'dl', 'defense', 24),
      person('T', 'dl', 'defense', 29),
      person('J', 'dl', 'defense', 35),
      person('W', 'lb', 'defense', 16),
      person('M', 'lb', 'defense', 27),
      person('$', 'lb', 'defense', 38),
      person('LC', 'db', 'defense', 6),
      person('RC', 'db', 'defense', 47),
      person('FS', 'db', 'defense', 33),
      person('Mike', 'lb', 'defense', 22),
    ]
    const next = migrateBuiltinLabels(players, '11v11')
    const label = (id: string) => next.find((player) => player.id === id)!.label
    expect(label('Z')).toBe('WR1')
    expect(label('Slot')).toBe('Slot')
    expect(label('X')).toBe('WR2')
    expect(label('Y')).toBe('TE')
    expect(label('E')).toBe('DE1')
    expect(label('J')).toBe('DE2')
    expect(label('N')).toBe('DT1')
    expect(label('T')).toBe('DT2')
    expect(label('W')).toBe('LB1')
    expect(label('M')).toBe('LB2')
    expect(label('$')).toBe('LB3')
    expect(label('LC')).toBe('CB1')
    expect(label('RC')).toBe('CB2')
    expect(label('FS')).toBe('FS')
    expect(label('Mike')).toBe('Mike')
    expect(migrateBuiltinLabels(next, '11v11').map((player) => player.label)).toEqual(next.map((player) => player.label))
  })

  it('turns flag linemen into rushers and a nose on the ball into NT', () => {
    const flag = migrateBuiltinLabels([person('E', 'dl', 'defense', 20), person('T', 'dl', 'defense', 30), person('S', 'db', 'defense', 36)], '5v5')
    expect(flag.map((player) => player.label)).toEqual(['R1', 'R2', 'S'])
    const nose = migrateBuiltinLabels([person('N', 'dl', 'defense', 26.7)], '11v11')
    expect(nose[0].label).toBe('NT')
  })

  it('migrates a saved play on load and keeps the route on the same player', () => {
    const raw = {
      id: 'old',
      name: 'Mesh',
      format: '5v5',
      formationId: 'doubles',
      players: [
        { id: 'a', label: 'X', role: 'wr', side: 'offense', x: 8, y: 0, read: 1 },
        { id: 'b', label: 'QB', role: 'qb', side: 'offense', x: 26, y: -5 },
      ],
      strokes: [{ id: 's', playerId: 'a', kind: 'route', points: [{ x: 8, y: 0 }, { x: 12, y: 6 }], curves: [null], preset: 'slant' }],
    }
    const play = sanitizePlay(raw)
    expect(play?.players.find((player) => player.id === 'a')?.label).toBe('WR')
    expect(play?.strokes[0].playerId).toBe('a')
    expect(play?.origin?.players.find((player) => player.id === 'a')?.label).toBe('WR')
  })
})
