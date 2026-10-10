import { hasLegacyBook } from './guest'
import { showcasePlay, sanitizePlay } from './play'
import { newBookId, placeUnbookedPlays, playbookName, sanitizePlaybook } from './playbooks'
import type { Play, Playbook } from './types'

const DB_NAME = 'night-yard'
const DB_VERSION = 2

interface MetaRecord {
  key: 'playbook'
  name: string
  seeded: boolean
  namedAt?: number
  currentId?: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('plays')) db.createObjectStore('plays', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('playbooks')) db.createObjectStore('playbooks', { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open the playbook.'))
    })
  }
  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Playbook request failed.'))
  })
}

async function transactionDone(tx: IDBTransaction): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Playbook write failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('Playbook write aborted.'))
  })
}

export async function resetStorageForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise
      db.close()
    } catch {
      /* The test database may already be gone. */
    }
  }
  dbPromise = null
}

export async function loadPlaybook(): Promise<{
  name: string
  plays: Play[]
  books: Playbook[]
  currentId: string
  freshSeed: { id: string; updatedAt: number } | null
  /** True when this phone already had a book. Those plays stay on the phone. */
  legacy: boolean
  namedAt: number
}> {
  const db = await openDb()
  const playTx = db.transaction('plays', 'readonly')
  const rawPlays = await requestToPromise(playTx.objectStore('plays').getAll())
  const metaTx = db.transaction('meta', 'readonly')
  const meta = (await requestToPromise(metaTx.objectStore('meta').get('playbook'))) as MetaRecord | undefined
  const bookTx = db.transaction('playbooks', 'readonly')
  const rawBooks = await requestToPromise(bookTx.objectStore('playbooks').getAll())
  const plays = (Array.isArray(rawPlays) ? rawPlays : [])
    .map((item) => sanitizePlay(item))
    .filter((play): play is Play => play !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const books = (Array.isArray(rawBooks) ? rawBooks : [])
    .map((item) => sanitizePlaybook(item, ''))
    .filter((book): book is Playbook => book !== null)
  const legacy = hasLegacyBook(plays.length, Boolean(meta?.seeded) || books.length > 0)
  if (!legacy) {
    const starter = showcasePlay()
    const bookId = newBookId()
    starter.bookId = bookId
    const book: Playbook = { id: bookId, name: 'Night Yard', updatedAt: starter.updatedAt, data: { migrated: true } }
    return {
      name: book.name,
      plays: [starter],
      books: [book],
      currentId: bookId,
      freshSeed: { id: starter.id, updatedAt: starter.updatedAt },
      legacy: false,
      namedAt: 0,
    }
  }
  const placed = placeUnbookedPlays({
    plays,
    books,
    preferredName: playbookName(meta?.name),
    bookId: meta?.currentId && books.some((book) => book.id === meta.currentId) ? meta.currentId : books[0]?.id || newBookId(),
    now: Date.now(),
    currentId: meta?.currentId,
  })
  if (placed.changed) {
    for (const play of placed.plays) await savePlay(play)
    for (const book of placed.books) await savePlaybookRecord(book)
    await saveCurrentBookId(placed.currentId)
  }
  const current = placed.books.find((book) => book.id === placed.currentId) ?? placed.books[0]
  return {
    name: current?.name || playbookName(meta?.name),
    plays: placed.plays,
    books: placed.books,
    currentId: placed.currentId,
    freshSeed: null,
    legacy: true,
    namedAt: meta?.namedAt ?? current?.updatedAt ?? 0,
  }
}

export async function savePlay(play: Play): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('plays', 'readwrite')
  tx.objectStore('plays').put(play)
  await transactionDone(tx)
}

export async function deletePlay(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('plays', 'readwrite')
  tx.objectStore('plays').delete(id)
  await transactionDone(tx)
}

export async function savePlaybookRecord(book: Playbook): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('playbooks', 'readwrite')
  tx.objectStore('playbooks').put(book)
  await transactionDone(tx)
}

export async function deletePlaybookRecord(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('playbooks', 'readwrite')
  tx.objectStore('playbooks').delete(id)
  await transactionDone(tx)
}

export async function saveCurrentBookId(id: string): Promise<void> {
  const db = await openDb()
  const readTx = db.transaction('meta', 'readonly')
  const previous = (await requestToPromise(readTx.objectStore('meta').get('playbook'))) as MetaRecord | undefined
  const tx = db.transaction('meta', 'readwrite')
  const record: MetaRecord = {
    key: 'playbook',
    name: previous?.name || 'Night Yard',
    seeded: previous?.seeded ?? true,
    namedAt: previous?.namedAt ?? 0,
    currentId: id,
  }
  tx.objectStore('meta').put(record)
  await transactionDone(tx)
}

export async function savePlaybookName(name: string, seeded = true, namedAt?: number): Promise<void> {
  const db = await openDb()
  const readTx = db.transaction('meta', 'readonly')
  const previous = (await requestToPromise(readTx.objectStore('meta').get('playbook'))) as MetaRecord | undefined
  const tx = db.transaction('meta', 'readwrite')
  const record: MetaRecord = {
    key: 'playbook',
    name: name.trim() || 'Night Yard',
    seeded,
    namedAt: namedAt ?? previous?.namedAt ?? 0,
    currentId: previous?.currentId,
  }
  tx.objectStore('meta').put(record)
  await transactionDone(tx)
}
