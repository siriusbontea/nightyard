import { chooseBookName, type BookNameStamp } from './bookName'
import { pb } from './pb'
import { bookIdForOwner, planPlaybookMerge, sanitizePlaybook, type RemotePlaybook } from './playbooks'
import { planMerge, remoteRow, withoutUntouchedSeed, type Tombstone } from './syncMerge'
import { loadBookTombstones, loadTombstones, saveBookTombstones, saveTombstones } from './tombstones'
import type { Play, Playbook } from './types'

export type SyncPhase = 'local' | 'pending' | 'synced'

export interface SyncState {
  signedIn: boolean
  username: string | null
  phase: SyncPhase
}

export interface SyncHandlers {
  getPlays: () => Play[]
  applyPlays: (plays: Play[]) => void
  getBooks: () => Playbook[]
  getCurrentBookId: () => string
  applyBooks: (books: Playbook[], currentId: string) => void
  adoptOwner: (ownerId: string) => void
  getBookName: () => BookNameStamp
  applyBookName: (name: string, namedAt: number) => void
}

type Listener = (state: SyncState) => void

let phase: SyncPhase = 'pending'
let handlers: SyncHandlers | null = null
let freshSeed: { id: string; updatedAt: number } | null = null
let tail: Promise<void> = Promise.resolve()
let timer = 0
const listeners = new Set<Listener>()

export function currentUsername(): string | null {
  if (!pb.authStore.isValid) return null
  const username = pb.authStore.record?.username
  return typeof username === 'string' && username ? username : null
}

export function getSyncState(): SyncState {
  const username = currentUsername()
  return { signedIn: Boolean(username), username, phase: username ? phase : 'local' }
}

export type SaveKind = 'account' | 'saving' | 'phone' | 'guest' | 'local' | 'none'

function onlineDefault(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

/** What the chip next to the play title should say. */
export function saveChip(
  saved: boolean,
  state: SyncState,
  online = onlineDefault(),
  guest = false,
): { label: string; kind: SaveKind } {
  if (guest) return { label: 'Not saved — make a free account', kind: 'guest' }
  if (!state.signedIn) return saved ? { label: 'Saved', kind: 'local' } : { label: '', kind: 'none' }
  if (state.phase === 'synced') return { label: '✓ Saved to your account', kind: 'account' }
  if (!online) return { label: 'Saved on this phone — will sync', kind: 'phone' }
  return { label: 'Saving…', kind: 'saving' }
}

/** Signed out: "Saved" once the phone write finishes. Signed in: the account chip. */
export function statusLine(saved: boolean, state: SyncState, online = onlineDefault()): string {
  return saveChip(saved, state, online).label
}

function publish() {
  const state = getSyncState()
  for (const listener of listeners) listener(state)
}

export function setFreshSeed(seed: { id: string; updatedAt: number } | null) {
  freshSeed = seed
}

export function subscribeSync(listener: Listener): () => void {
  listeners.add(listener)
  listener(getSyncState())
  return () => listeners.delete(listener)
}

function notFound(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { status?: number }).status === 404
}

function authRejected(error: unknown): boolean {
  const status = error && typeof error === 'object' ? (error as { status?: number }).status : 0
  return status === 401 || status === 403
}

async function findPlay(playId: string) {
  try {
    return await pb.collection('plays').getFirstListItem(pb.filter('play_id = {:id}', { id: playId }))
  } catch (error) {
    if (notFound(error)) return null
    throw error
  }
}

async function writePlay(ownerId: string, playId: string, data: unknown, deleted: boolean) {
  const bookId = data && typeof data === 'object' && typeof (data as Play).bookId === 'string' ? (data as Play).bookId : ''
  const body = { owner: ownerId, play_id: playId, book_id: bookId, data, deleted }
  const existing = await findPlay(playId)
  if (existing) {
    await pb.collection('plays').update(existing.id, body)
    return
  }
  try {
    await pb.collection('plays').create(body)
  } catch (error) {
    const again = await findPlay(playId)
    if (!again) throw error
    await pb.collection('plays').update(again.id, body)
  }
}

async function runSync() {
  if (!pb.authStore.isValid || !currentUsername()) {
    phase = 'local'
    publish()
    return
  }
  phase = 'pending'
  publish()
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const bound = handlers
  if (!bound) return
  try {
    const ownerEarly = pb.authStore.record?.id
    if (ownerEarly) bound.adoptOwner(ownerEarly)
    const records = await pb.collection('plays').getFullList({ requestKey: null })
    const remote = records.map((record) => remoteRow(record)).filter((row): row is NonNullable<typeof row> => !!row)
    const local = withoutUntouchedSeed(bound.getPlays(), remote, freshSeed)
    freshSeed = null
    const plan = planMerge(local, remote, loadTombstones())
    const ownerId = pb.authStore.record?.id
    if (!ownerId) return
    const home = bound.getCurrentBookId() || bookIdForOwner(ownerId)
    const now = Date.now()
    const upserts = [...plan.upserts]
    const plays = plan.plays.map((play) => {
      if (play.bookId) return play
      const next = { ...play, bookId: home, updatedAt: Math.max(play.updatedAt, now) }
      const index = upserts.findIndex((item) => item.id === play.id)
      if (index >= 0) upserts[index] = next
      else upserts.push(next)
      return next
    })
    bound.applyPlays(plays)
    saveTombstones(plan.keepTombstones)
    for (const play of upserts) await writePlay(ownerId, play.id, play, false)
    for (const item of plan.keepTombstones) {
      await writePlay(ownerId, item.playId, { id: item.playId, updatedAt: item.updatedAt }, true)
    }
    saveTombstones([])
    await syncPlaybooks(ownerId)
    try {
      await reconcileBookName(ownerId)
    } catch {
      /* The name field is optional. Playbooks still sync. */
    }
    phase = 'synced'
  } catch {
    phase = 'pending'
  }
  publish()
}

function bookFromRecord(record: { book_id?: unknown; name?: unknown; deleted?: unknown; data?: unknown }): RemotePlaybook | null {
  if (typeof record.book_id !== 'string' || !record.book_id) return null
  const data = record.data && typeof record.data === 'object' ? (record.data as { updatedAt?: unknown }) : {}
  const updatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : 0
  const deleted = Boolean(record.deleted)
  const book = deleted
    ? null
    : sanitizePlaybook(
        { id: record.book_id, name: record.name, updatedAt, data: record.data },
        typeof record.name === 'string' ? record.name : 'My Playbook',
      )
  return { bookId: record.book_id, deleted, updatedAt: book?.updatedAt ?? updatedAt, book }
}

async function findBook(bookId: string) {
  try {
    return await pb.collection('playbooks').getFirstListItem(pb.filter('book_id = {:id}', { id: bookId }))
  } catch (error) {
    if (notFound(error)) return null
    throw error
  }
}

async function writeBook(ownerId: string, book: Playbook, deleted: boolean) {
  const body = {
    owner: ownerId,
    book_id: book.id,
    name: book.name,
    data: { ...book.data, updatedAt: book.updatedAt },
    deleted,
  }
  const existing = await findBook(book.id)
  if (existing) {
    await pb.collection('playbooks').update(existing.id, body)
    return
  }
  try {
    await pb.collection('playbooks').create(body)
  } catch (error) {
    const again = await findBook(book.id)
    if (!again) throw error
    await pb.collection('playbooks').update(again.id, body)
  }
}

async function syncPlaybooks(ownerId: string) {
  const bound = handlers
  if (!bound) return
  const records = await pb.collection('playbooks').getFullList({ requestKey: null })
  const remote = records
    .map((record) => bookFromRecord(record as { book_id?: unknown; name?: unknown; deleted?: unknown; data?: unknown }))
    .filter((row): row is RemotePlaybook => !!row)
  const plan = planPlaybookMerge(bound.getBooks(), remote, loadBookTombstones())
  const wanted = bound.getCurrentBookId()
  const current = plan.books.some((book) => book.id === wanted) ? wanted : (plan.books[0]?.id ?? '')
  bound.applyBooks(plan.books, current)
  saveBookTombstones(plan.keep)
  for (const book of plan.upserts) await writeBook(ownerId, book, false)
  for (const item of plan.keep) {
    await writeBook(ownerId, { id: item.id, name: 'Deleted', updatedAt: item.updatedAt, data: {} }, true)
  }
  saveBookTombstones([])
}

async function reconcileBookName(ownerId: string) {
  const bound = handlers
  if (!bound) return
  const user = await pb.collection('users').getOne(ownerId)
  const remoteName = typeof user.playbook_name === 'string' ? user.playbook_name : ''
  const remoteAt = typeof user.playbook_named_at === 'number' ? user.playbook_named_at : 0
  const local = bound.getBookName()
  const choice = chooseBookName(local, { name: remoteName, namedAt: remoteAt })
  if (choice.push) {
    await pb.collection('users').update(ownerId, {
      playbook_name: choice.name,
      playbook_named_at: choice.namedAt,
    })
  }
  if (choice.name !== local.name || choice.namedAt !== local.namedAt) {
    bound.applyBookName(choice.name, choice.namedAt)
    const named = bound.getBooks().filter((book) => book.name === choice.name)
    for (const book of named) await writeBook(ownerId, book, false)
  }
}

export function syncNow(): Promise<void> {
  const run = tail.then(() => runSync(), () => runSync())
  tail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export function scheduleSync() {
  if (!pb.authStore.isValid) return
  phase = 'pending'
  publish()
  if (typeof window === 'undefined') return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    void syncNow()
  }, 400)
}

export function rememberDelete(playId: string, updatedAt = Date.now()) {
  const next = loadTombstones().filter((item) => item.playId !== playId)
  next.push({ playId, updatedAt })
  saveTombstones(next)
  scheduleSync()
}

export function forgetDelete(playId: string) {
  saveTombstones(loadTombstones().filter((item) => item.playId !== playId))
}

export function rememberBookDelete(bookId: string, updatedAt = Date.now()) {
  const next = loadBookTombstones().filter((item) => item.id !== bookId)
  next.push({ id: bookId, updatedAt })
  saveBookTombstones(next)
  scheduleSync()
}

export function bootSync(next: SyncHandlers): () => void {
  handlers = next
  const stopAuth = pb.authStore.onChange(() => {
    publish()
    if (pb.authStore.isValid) void syncNow()
  })
  const onOnline = () => {
    void syncNow()
  }
  window.addEventListener('online', onOnline)
  void (async () => {
    if (pb.authStore.isValid) {
      try {
        await pb.collection('users').authRefresh()
      } catch (error) {
        if (authRejected(error)) pb.authStore.clear()
      }
    }
    publish()
    if (pb.authStore.isValid) await syncNow()
  })()
  return () => {
    if (handlers === next) handlers = null
    stopAuth()
    window.removeEventListener('online', onOnline)
  }
}

export type { Tombstone }
