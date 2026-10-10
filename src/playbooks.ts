import type { Play, Playbook, PlaybookData } from './types'

export const MY_PLAYBOOK = 'My Playbook'

export function bookIdForOwner(ownerId: string): string {
  return `book-${ownerId}`
}

export function newBookId(): string {
  return crypto.randomUUID()
}

/** The stored playbook name, or My Playbook when the phone never named one. */
export function playbookName(value: string | null | undefined): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
  return text || MY_PLAYBOOK
}

export function playsInBook(plays: readonly Play[], bookId: string): Play[] {
  return plays.filter((play) => play.bookId === bookId)
}

export function deleteBookLabel(name: string, count: number): string {
  if (count === 1) return `Delete ${name}? This removes 1 play.`
  return `Delete ${name}? This removes ${count} plays.`
}

export function placeUnbookedPlays(input: {
  plays: Play[]
  books: Playbook[]
  preferredName: string
  bookId: string
  now: number
  currentId?: string | null
}): { plays: Play[]; books: Playbook[]; currentId: string; changed: boolean } {
  const books = input.books.map((book) => ({ ...book, data: { ...book.data } }))
  let changed = false
  let home = books.find((book) => book.id === input.bookId)
  const known = new Set(books.map((book) => book.id))
  const needsHome = input.plays.some((play) => !play.bookId || !known.has(play.bookId))
  if (!home && (books.length === 0 || needsHome)) {
    home = {
      id: input.bookId,
      name: playbookName(input.preferredName),
      updatedAt: input.now,
      data: { migrated: true },
    }
    books.unshift(home)
    changed = true
  }
  if (books.length === 0) {
    home = {
      id: input.bookId,
      name: playbookName(input.preferredName),
      updatedAt: input.now,
      data: { migrated: true },
    }
    books.push(home)
    changed = true
  }
  const fallback = home?.id ?? books[0].id
  const plays = input.plays.map((play) => {
    if (play.bookId && known.has(play.bookId)) return play
    changed = true
    return { ...play, bookId: fallback, updatedAt: Math.max(play.updatedAt, input.now) }
  })
  const currentId = input.currentId && books.some((book) => book.id === input.currentId) ? input.currentId : books[0].id
  return { plays, books, currentId, changed }
}

/** One local book becomes the account book so two phones share it. */
export function adoptOwnerBook(
  books: Playbook[],
  plays: Play[],
  ownerId: string,
): { books: Playbook[]; plays: Play[]; changed: boolean } {
  const nextId = bookIdForOwner(ownerId)
  if (books.some((book) => book.id === nextId) || books.length !== 1) {
    return { books, plays, changed: false }
  }
  const previous = books[0].id
  if (previous === nextId) return { books, plays, changed: false }
  return {
    changed: true,
    books: [{ ...books[0], id: nextId, updatedAt: Date.now() }],
    plays: plays.map((play) => (play.bookId === previous ? { ...play, bookId: nextId } : play)),
  }
}

export function movePlay(play: Play, bookId: string, now = Date.now()): Play {
  return { ...play, bookId, updatedAt: now }
}

export function renamePlaybook(book: Playbook, name: string, now = Date.now()): Playbook {
  return { ...book, name: playbookName(name), updatedAt: now }
}

export function emptyPlaybook(name: string, now = Date.now(), id = newBookId()): Playbook {
  return { id, name: playbookName(name), updatedAt: now, data: {} }
}

export function copyName(name: string): string {
  const base = playbookName(name)
  const next = `${base} copy`
  return next.length > 60 ? `${base.slice(0, 54).trimEnd()} copy` : next
}

export interface RemotePlaybook {
  bookId: string
  deleted: boolean
  updatedAt: number
  book: Playbook | null
}

export interface BookTombstone {
  id: string
  updatedAt: number
}

/** Newest `updatedAt` wins. A tie keeps the server book. */
export function planPlaybookMerge(
  local: Playbook[],
  remote: RemotePlaybook[],
  tombstones: BookTombstone[],
): { books: Playbook[]; upserts: Playbook[]; keep: BookTombstone[] } {
  const byId = new Map(local.map((book) => [book.id, book]))
  const tombs = new Map(tombstones.map((item) => [item.id, item.updatedAt]))
  const upserts: Playbook[] = []
  const keep = new Map<string, number>()
  const seen = new Set<string>()
  const queueDelete = (id: string, updatedAt: number) => {
    const current = keep.get(id)
    if (current === undefined || updatedAt > current) keep.set(id, updatedAt)
  }
  for (const row of remote) {
    seen.add(row.bookId)
    const localBook = byId.get(row.bookId)
    const localStamp = localBook ? localBook.updatedAt : tombs.get(row.bookId)
    if (localStamp === undefined) {
      if (!row.deleted && row.book) byId.set(row.bookId, row.book)
      continue
    }
    if (localStamp > row.updatedAt) {
      if (localBook) upserts.push(localBook)
      else {
        byId.delete(row.bookId)
        queueDelete(row.bookId, localStamp)
      }
      continue
    }
    tombs.delete(row.bookId)
    if (row.deleted || !row.book) byId.delete(row.bookId)
    else byId.set(row.bookId, row.book)
  }
  for (const book of local) {
    if (seen.has(book.id)) continue
    const tomb = tombs.get(book.id)
    if (tomb !== undefined && tomb >= book.updatedAt) {
      byId.delete(book.id)
      queueDelete(book.id, tomb)
      continue
    }
    upserts.push(book)
  }
  for (const [id, updatedAt] of tombs) {
    if (byId.has(id)) continue
    queueDelete(id, updatedAt)
  }
  const books: Playbook[] = []
  const used = new Set<string>()
  for (const book of local) {
    const next = byId.get(book.id)
    if (!next) continue
    books.push(next)
    used.add(book.id)
  }
  for (const [id, book] of byId) {
    if (used.has(id)) continue
    books.push(book)
  }
  return { books, upserts, keep: [...keep.entries()].map(([id, updatedAt]) => ({ id, updatedAt })) }
}

export function sanitizePlaybook(input: unknown, fallbackName: string): Playbook | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Partial<Playbook>
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null
  const data = raw.data && typeof raw.data === 'object' ? (raw.data as PlaybookData) : {}
  return {
    id: raw.id.slice(0, 80),
    name: playbookName(typeof raw.name === 'string' ? raw.name : fallbackName),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    data: {
      ...(data.defaultFormat ? { defaultFormat: data.defaultFormat } : {}),
      ...(data.migrated ? { migrated: true } : {}),
    },
  }
}
