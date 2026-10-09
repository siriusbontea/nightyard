import { pb } from './pb'
import { planMerge, remoteRow, type Tombstone } from './syncMerge'
import { loadTombstones, saveTombstones } from './tombstones'
import type { Play } from './types'

export type SyncPhase = 'local' | 'pending' | 'synced'

export interface SyncState {
  signedIn: boolean
  username: string | null
  phase: SyncPhase
}

export interface SyncHandlers {
  getPlays: () => Play[]
  applyPlays: (plays: Play[]) => void
}

type Listener = (state: SyncState) => void

let phase: SyncPhase = 'pending'
let handlers: SyncHandlers | null = null
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

/** Signed out: "Saved" once the phone write finishes. Signed in: pending until the server catches up. */
export function statusLine(saved: boolean, state: SyncState): string {
  if (!state.signedIn) return saved ? 'Saved' : ''
  if (state.phase === 'synced') return 'Synced'
  return 'Saved on this phone, will sync'
}

function publish() {
  const state = getSyncState()
  for (const listener of listeners) listener(state)
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
  const body = { owner: ownerId, play_id: playId, data, deleted }
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
    const local = bound.getPlays()
    const records = await pb.collection('plays').getFullList({ requestKey: null })
    const remote = records.map((record) => remoteRow(record)).filter((row): row is NonNullable<typeof row> => !!row)
    const plan = planMerge(local, remote, loadTombstones())
    bound.applyPlays(plan.plays)
    saveTombstones(plan.keepTombstones)
    const ownerId = pb.authStore.record?.id
    if (!ownerId) return
    for (const play of plan.upserts) await writePlay(ownerId, play.id, play, false)
    for (const item of plan.keepTombstones) {
      await writePlay(ownerId, item.playId, { id: item.playId, updatedAt: item.updatedAt }, true)
    }
    saveTombstones([])
    phase = 'synced'
  } catch {
    phase = 'pending'
  }
  publish()
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
