import type { Tombstone } from './syncMerge'

const KEY = 'night-yard-tombstones'
const BOOK_KEY = 'night-yard-book-tombstones'

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadTombstones(): Tombstone[] {
  const raw = storage()?.getItem(KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is Tombstone =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as Tombstone).playId === 'string' &&
        typeof (item as Tombstone).updatedAt === 'number',
    )
  } catch {
    return []
  }
}

export function saveTombstones(items: Tombstone[]) {
  storage()?.setItem(KEY, JSON.stringify(items))
}

export function loadBookTombstones(): { id: string; updatedAt: number }[] {
  const raw = storage()?.getItem(BOOK_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is { id: string; updatedAt: number } =>
        !!item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' && typeof (item as { updatedAt?: unknown }).updatedAt === 'number',
    )
  } catch {
    return []
  }
}

export function saveBookTombstones(items: { id: string; updatedAt: number }[]) {
  storage()?.setItem(BOOK_KEY, JSON.stringify(items))
}

export function clearTombstones(): void {
  const box = storage()
  box?.removeItem(KEY)
  box?.removeItem(BOOK_KEY)
}
