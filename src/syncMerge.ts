import type { Play } from './types'

export interface Tombstone {
  playId: string
  updatedAt: number
}

export interface RemoteRow {
  recordId: string
  playId: string
  deleted: boolean
  updatedAt: number
  play: Play | null
}

export interface MergePlan {
  /** Plays that should be on this phone, in the local order, with new remote plays after. */
  plays: Play[]
  /** Local plays the server should store. */
  upserts: Play[]
  /** Deletes still to push. These replace the tombstone list. */
  keepTombstones: Tombstone[]
}

function asPlay(data: unknown): Play | null {
  if (!data || typeof data !== 'object') return null
  const play = data as Play
  if (typeof play.id !== 'string' || typeof play.updatedAt !== 'number') return null
  return play
}

export function remoteRow(record: {
  id: string
  play_id?: unknown
  deleted?: unknown
  data?: unknown
}): RemoteRow | null {
  if (typeof record.play_id !== 'string' || !record.play_id) return null
  const play = asPlay(record.data)
  const updatedAt = play?.updatedAt ?? 0
  const deleted = Boolean(record.deleted)
  return {
    recordId: record.id,
    playId: record.play_id,
    deleted,
    updatedAt,
    play: deleted ? null : play,
  }
}

/**
 * Newest `updatedAt` wins. A tie keeps the server row.
 * A newer local delete becomes a tombstone push. A newer server delete drops the local play.
 */
export function planMerge(local: Play[], remote: RemoteRow[], tombstones: Tombstone[]): MergePlan {
  const byId = new Map<string, Play>()
  for (const play of local) byId.set(play.id, play)

  const tombs = new Map<string, number>()
  for (const item of tombstones) tombs.set(item.playId, item.updatedAt)

  const upserts: Play[] = []
  const keep = new Map<string, number>()
  const seen = new Set<string>()

  const queueDelete = (playId: string, updatedAt: number) => {
    const current = keep.get(playId)
    if (current === undefined || updatedAt > current) keep.set(playId, updatedAt)
  }

  for (const row of remote) {
    seen.add(row.playId)
    const localPlay = byId.get(row.playId)
    const localStamp = localPlay ? localPlay.updatedAt : tombs.get(row.playId)
    if (localStamp === undefined) {
      if (!row.deleted && row.play) byId.set(row.playId, row.play)
      continue
    }
    if (localStamp > row.updatedAt) {
      if (localPlay) upserts.push(localPlay)
      else {
        byId.delete(row.playId)
        queueDelete(row.playId, localStamp)
      }
      continue
    }
    tombs.delete(row.playId)
    if (row.deleted || !row.play) byId.delete(row.playId)
    else byId.set(row.playId, row.play)
  }

  for (const play of local) {
    if (seen.has(play.id)) continue
    const tomb = tombs.get(play.id)
    if (tomb !== undefined && tomb >= play.updatedAt) {
      byId.delete(play.id)
      queueDelete(play.id, tomb)
      continue
    }
    upserts.push(play)
  }

  for (const [playId, updatedAt] of tombs) {
    if (byId.has(playId)) continue
    queueDelete(playId, updatedAt)
  }

  const plays: Play[] = []
  const used = new Set<string>()
  for (const play of local) {
    const next = byId.get(play.id)
    if (!next) continue
    plays.push(next)
    used.add(play.id)
  }
  for (const [id, play] of byId) {
    if (used.has(id)) continue
    plays.push(play)
  }

  return {
    plays,
    upserts,
    keepTombstones: [...keep.entries()].map(([playId, updatedAt]) => ({ playId, updatedAt })),
  }
}
