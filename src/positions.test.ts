import { describe, expect, it } from 'vitest'
import { createPlay } from './play'
import { applyPosition, positionsFor } from './positions'

describe('positions', () => {
  it('uses a short flag list and the full tackle list', () => {
    expect(positionsFor('5v5', 'offense').map((option) => option.label)).toEqual(['QB', 'RB', 'WR', 'C'])
    expect(positionsFor('5v5', 'defense').map((option) => option.label)).toEqual(['LB', 'CB', 'S'])
    expect(positionsFor('7v7', 'offense').map((option) => option.label)).toContain('G')
    expect(positionsFor('7v7', 'offense').map((option) => option.label)).not.toContain('TE')
    expect(positionsFor('11v11', 'offense').map((option) => option.label)).toEqual([
      'QB',
      'RB',
      'FB',
      'TE',
      'WR',
      'C',
      'G',
      'T',
      'K',
      'P',
      'LS',
      'H',
      'KR',
      'PR',
      'Gun',
      'Wing',
    ])
    expect(positionsFor('11v11', 'defense').map((option) => option.label)).toEqual(['LB', 'CB', 'S', 'DE', 'DT', 'DL'])
  })

  it('refuses a tackle spot on a flag player and keeps the name when the spot is already theirs', () => {
    const play = createPlay({ format: '5v5', formationId: 'doubles' })
    const wr = play.players.find((player) => player.label === 'X')!
    expect(applyPosition(play, wr, 'te').label).toBe('X')
    expect(applyPosition(play, wr, 'wr').label).toBe('X')
  })
})
