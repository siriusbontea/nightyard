import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Play, Playbook } from './types'

const h = vi.hoisted(() => {
  const calls: string[] = []
  const listeners = new Set<(token: string, record: unknown) => void>()
  const auth = {
    valid: true,
    record: { id: 'user1', username: 'sirius', playbook_name: 'Night Yard', playbook_named_at: 10 },
    onChange(cb: (token: string, record: unknown) => void) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    get isValid() {
      return auth.valid
    },
    get token() {
      return 'token'
    },
    clear() {
      auth.valid = false
    },
  }
  const play = {
    id: 'p1',
    name: 'Playz',
    formation: 'Trips',
    formationId: 'trips',
    format: '11v11',
    los: 30,
    notes: '',
    ourSide: 'offense',
    showDefense: false,
    players: [],
    strokes: [],
    createdAt: 10,
    updatedAt: 50,
    bookId: 'book-user1',
  }
  const book = { id: 'book-user1', name: 'Night Yard', updatedAt: 10, data: {} }
  return { calls, listeners, auth, play, book }
})

vi.mock('./pb', () => ({
  pb: {
    authStore: h.auth,
    filter: (expr: string) => expr,
    collection: (name: string) => ({
      async getFullList() {
        h.calls.push(`GET ${name}`)
        if (name === 'plays') {
          return [{ id: 'r1', play_id: h.play.id, book_id: h.play.bookId, deleted: false, data: h.play }]
        }
        return [{ id: 'b1', book_id: h.book.id, name: h.book.name, deleted: false, data: { updatedAt: h.book.updatedAt } }]
      },
      async getFirstListItem() {
        h.calls.push(`FIND ${name}`)
        const error = new Error('missing') as Error & { status?: number }
        error.status = 404
        throw error
      },
      async getOne() {
        h.calls.push('GET users')
        return h.auth.record
      },
      async update() {
        h.calls.push(`PATCH ${name}`)
        if (name === 'users') {
          for (const listener of h.listeners) listener(h.auth.token, h.auth.record)
        }
        return h.auth.record
      },
      async create() {
        h.calls.push(`POST ${name}`)
        return { id: 'new' }
      },
      async authRefresh() {
        h.calls.push('POST auth-refresh')
        for (const listener of h.listeners) listener(h.auth.token, h.auth.record)
        return h.auth.record
      },
    }),
  },
}))

import { bootSync, getSyncState, resetSyncForTests, scheduleSync } from './sync'

function memory() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    },
  })
}

describe('sync steady state', () => {
  afterEach(() => {
    resetSyncForTests()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('makes zero requests over 10 seconds once the account matches this phone', async () => {
    vi.useFakeTimers()
    memory()
    h.calls.length = 0
    h.auth.valid = true
    const plays: Play[] = [h.play as Play]
    const books: Playbook[] = [h.book]
    const stop = bootSync({
      getPlays: () => plays,
      applyPlays: () => {
        scheduleSync()
      },
      getBooks: () => books,
      getCurrentBookId: () => books[0].id,
      applyBooks: () => {
        scheduleSync()
      },
      adoptOwner: () => {},
      getBookName: () => ({ name: 'Night Yard', namedAt: 10 }),
      applyBookName: () => {
        scheduleSync()
      },
    })

    for (let i = 0; i < 20; i += 1) {
      await vi.advanceTimersByTimeAsync(500)
    }
    expect(getSyncState().phase).toBe('synced')
    expect(h.calls.some((call) => call.startsWith('GET plays'))).toBe(true)
    const settled = h.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(h.calls.length).toBe(settled)
    expect(getSyncState().phase).toBe('synced')
    expect(h.calls.filter((call) => call.startsWith('PATCH'))).toEqual([])
    stop()
  })

  it('does not pull while offline, then pulls once the phone is back', async () => {
    vi.useFakeTimers()
    memory()
    h.calls.length = 0
    const nav = { onLine: false }
    vi.stubGlobal('navigator', nav)
    const plays: Play[] = [h.play as Play]
    const books: Playbook[] = [h.book]
    const stop = bootSync({
      getPlays: () => plays,
      applyPlays: () => {
        scheduleSync()
      },
      getBooks: () => books,
      getCurrentBookId: () => books[0].id,
      applyBooks: () => {
        scheduleSync()
      },
      adoptOwner: () => {},
      getBookName: () => ({ name: 'Night Yard', namedAt: 10 }),
      applyBookName: () => {
        scheduleSync()
      },
    })

    await vi.advanceTimersByTimeAsync(2_000)
    expect(h.calls.filter((call) => call.startsWith('GET plays'))).toEqual([])
    expect(h.calls.filter((call) => call.startsWith('PATCH'))).toEqual([])
    expect(getSyncState().phase).toBe('pending')

    nav.onLine = true
    scheduleSync()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(h.calls.filter((call) => call.startsWith('GET plays')).length).toBeGreaterThan(0)
    expect(getSyncState().phase).toBe('synced')
    const settled = h.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(h.calls.length).toBe(settled)
    stop()
  })
})
