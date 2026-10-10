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

  it('holds a guest starter in memory, then keeps a book once it is saved', async () => {
    const first = await loadPlaybook()
    expect(first.name).toBe('Night Yard')
    expect(first.legacy).toBe(false)
    expect(first.plays).toHaveLength(1)
    expect(first.plays[0].name).toBe('Corndog')
    expect(first.plays[0].format).toBe('11v11')
    expect(first.plays[0].los).toBe(3)
    expect(first.freshSeed?.id).toBe(first.plays[0].id)

    const stillGuest = await loadPlaybook()
    expect(stillGuest.legacy).toBe(false)
    expect(stillGuest.plays[0].id).not.toBe(first.plays[0].id)

    const extra = createPlay({ format: '7v7', formationId: 'spread', name: 'Flood' })
    await savePlay(first.plays[0])
    await savePlay(extra)
    await savePlaybookName('Friday night')
    const loaded = await loadPlaybook()
    expect(loaded.legacy).toBe(true)
    expect(loaded.name).toBe('Friday night')
    expect(loaded.plays.map((play) => play.name).sort()).toEqual(['Corndog', 'Flood'])
    expect(loaded.freshSeed).toBeNull()

    await deletePlay(extra.id)
    const after = await loadPlaybook()
    expect(after.legacy).toBe(true)
    expect(after.plays.map((play) => play.id)).toEqual([first.plays[0].id])
    expect(after.name).toBe('Friday night')
    expect(after.namedAt).toBe(0)
  })

  it('remembers when the playbook was named', async () => {
    const first = await loadPlaybook()
    await savePlay(first.plays[0])
    await savePlaybookName('Friday night', true, 80)
    const loaded = await loadPlaybook()
    expect(loaded.name).toBe('Friday night')
    expect(loaded.namedAt).toBe(80)
    await savePlaybookName('Friday night')
    expect((await loadPlaybook()).namedAt).toBe(80)
  })

  it('does not resurrect the starter after the book has been seeded and emptied', async () => {
    const first = await loadPlaybook()
    await savePlay(first.plays[0])
    await savePlaybookName('Night Yard')
    await deletePlay(first.plays[0].id)
    const empty = await loadPlaybook()
    expect(empty.legacy).toBe(true)
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

  it('upgrades a version 1 database and keeps the plays in one playbook', async () => {
    const opened = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('night-yard', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('plays', { keyPath: 'id' })
        request.result.createObjectStore('meta', { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const play = createPlay({ format: '11v11', formationId: 'shotgun-trips', name: 'Stick' })
    delete play.bookId
    await new Promise<void>((resolve, reject) => {
      const tx = opened.transaction(['plays', 'meta'], 'readwrite')
      tx.objectStore('plays').put(play)
      tx.objectStore('meta').put({ key: 'playbook', name: 'Friday night', seeded: true, namedAt: 10 })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    opened.close()
    const loaded = await loadPlaybook()
    expect(loaded.legacy).toBe(true)
    expect(loaded.name).toBe('Friday night')
    expect(loaded.namedAt).toBe(10)
    expect(loaded.books).toHaveLength(1)
    expect(loaded.plays).toHaveLength(1)
    expect(loaded.plays[0].id).toBe(play.id)
    expect(loaded.plays[0].name).toBe('Stick')
    expect(loaded.plays[0].bookId).toBe(loaded.currentId)
    const again = await loadPlaybook()
    expect(again.plays[0].bookId).toBe(loaded.currentId)
    expect(again.books[0].id).toBe(loaded.books[0].id)
  })
})
