import { describe, expect, it } from 'vitest'
import { planMerge, remoteRow, type RemoteRow } from './syncMerge'
import type { Play } from './types'

function play(id: string, updatedAt: number, name = id): Play {
  return {
    id,
    name,
    formation: 'Trips',
    formationId: 'trips',
    format: '5v5',
    los: 50,
    notes: '',
    ourSide: 'offense',
    showDefense: false,
    players: [],
    strokes: [],
    createdAt: 1,
    updatedAt,
  }
}

function row(playId: string, updatedAt: number, deleted = false, name = playId): RemoteRow {
  return {
    recordId: `rec-${playId}`,
    playId,
    deleted,
    updatedAt,
    play: deleted ? null : play(playId, updatedAt, name),
  }
}

describe('planMerge', () => {
  it('keeps the newer copy and pushes a newer local play', () => {
    const local = play('a', 20, 'Local')
    const plan = planMerge([local], [row('a', 10, false, 'Remote')], [])
    expect(plan.plays.map((item) => item.name)).toEqual(['Local'])
    expect(plan.upserts.map((item) => item.name)).toEqual(['Local'])
    expect(plan.keepTombstones).toEqual([])
  })

  it('takes a newer server play and a tie', () => {
    const newer = planMerge([play('a', 5, 'Old')], [row('a', 9, false, 'New')], [])
    expect(newer.plays.map((item) => item.name)).toEqual(['New'])
    expect(newer.upserts).toEqual([])

    const tie = planMerge([play('a', 9, 'Phone')], [row('a', 9, false, 'Server')], [])
    expect(tie.plays.map((item) => item.name)).toEqual(['Server'])
    expect(tie.upserts).toEqual([])
  })

  it('drops a play when the server delete is newer and pushes a newer local delete', () => {
    const dropped = planMerge([play('a', 4)], [row('a', 8, true)], [{ playId: 'a', updatedAt: 4 }])
    expect(dropped.plays).toEqual([])
    expect(dropped.keepTombstones).toEqual([])

    const pushed = planMerge([], [row('a', 4, false, 'Still there')], [{ playId: 'a', updatedAt: 12 }])
    expect(pushed.plays).toEqual([])
    expect(pushed.keepTombstones).toEqual([{ playId: 'a', updatedAt: 12 }])
  })

  it('uploads a phone-only play and downloads a server-only play', () => {
    const plan = planMerge([play('local', 3)], [row('remote', 7, false, 'From server')], [])
    expect(plan.plays.map((item) => item.id)).toEqual(['local', 'remote'])
    expect(plan.upserts.map((item) => item.id)).toEqual(['local'])
  })

  it('keeps local order', () => {
    const plan = planMerge(
      [play('b', 2), play('a', 1)],
      [row('a', 5, false, 'A2'), row('c', 3, false, 'C')],
      [],
    )
    expect(plan.plays.map((item) => item.id)).toEqual(['b', 'a', 'c'])
    expect(plan.plays[1]?.name).toBe('A2')
  })
})

describe('remoteRow', () => {
  it('reads a play and a tombstone', () => {
    expect(remoteRow({ id: '1', play_id: 'p', deleted: false, data: play('p', 4) })?.play?.id).toBe('p')
    const tomb = remoteRow({ id: '1', play_id: 'p', deleted: true, data: { id: 'p', updatedAt: 9 } })
    expect(tomb).toMatchObject({ deleted: true, updatedAt: 9, play: null })
    expect(remoteRow({ id: '1', play_id: '', data: {} })).toBeNull()
  })
})
