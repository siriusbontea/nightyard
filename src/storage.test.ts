import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPlay, parseBundle, serializePlaybook } from './play'
import { deletePlay, loadPlaybook, resetStorageForTests, savePlay, savePlaybookName } from './storage'

describe('playbook save and load', () => {
  beforeEach(async () => {
    await resetStorageForTests()
    globalThis.indexedDB = new IDBFactory()
  })

  it('seeds a starter play, then saves, renames, and deletes', async () => {
    const first = await loadPlaybook()
    expect(first.name).toBe('Night Yard')
    expect(first.plays).toHaveLength(1)
    expect(first.plays[0].name).toBe('Slant Read')

    const extra = createPlay({ format: '7v7', formationId: 'spread', name: 'Flood' })
    await savePlay(extra)
    await savePlaybookName('Friday night')
    const loaded = await loadPlaybook()
    expect(loaded.name).toBe('Friday night')
    expect(loaded.plays.map((play) => play.name).sort()).toEqual(['Flood', 'Slant Read'])

    await deletePlay(extra.id)
    const after = await loadPlaybook()
    expect(after.plays.map((play) => play.id)).toEqual([first.plays[0].id])
    expect(after.name).toBe('Friday night')
  })

  it('does not resurrect the starter after the book has been seeded and emptied', async () => {
    const first = await loadPlaybook()
    await deletePlay(first.plays[0].id)
    const empty = await loadPlaybook()
    expect(empty.plays).toHaveLength(0)
  })

  it('reloads a playbook that was exported and parsed', async () => {
    await loadPlaybook()
    const created = createPlay({ format: '11v11', formationId: 'i-form', name: 'Power' })
    await savePlay(created)
    const live = await loadPlaybook()
    const parsed = parseBundle(serializePlaybook(live.name, live.plays))
    for (const play of parsed.plays) await savePlay(play)
    const again = await loadPlaybook()
    const power = again.plays.find((play) => play.name === 'Power')
    expect(power?.format).toBe('11v11')
    expect(power?.players.filter((player) => player.side === 'offense')).toHaveLength(11)
    expect(power?.formation).toBe('I Form')
  })
})
