import type { Tombstone } from './syncMerge'

const KEY = 'night-yard-tombstones'

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
