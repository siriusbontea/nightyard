import { showcasePlay, sanitizePlay } from './play'
import type { Play } from './types'

const DB_NAME = 'night-yard'
const DB_VERSION = 1

interface MetaRecord {
  key: 'playbook'
  name: string
  seeded: boolean
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

export async function loadPlaybook(): Promise<{ name: string; plays: Play[] }> {
  const db = await openDb()
  const playTx = db.transaction('plays', 'readonly')
  const rawPlays = await requestToPromise(playTx.objectStore('plays').getAll())
  const metaTx = db.transaction('meta', 'readonly')
  const meta = (await requestToPromise(metaTx.objectStore('meta').get('playbook'))) as MetaRecord | undefined
  const plays = (Array.isArray(rawPlays) ? rawPlays : [])
    .map((item) => sanitizePlay(item))
    .filter((play): play is Play => play !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  if (plays.length === 0 && !meta?.seeded) {
    const starter = showcasePlay()
    await savePlay(starter)
    await savePlaybookName('Night Yard', true)
    return { name: 'Night Yard', plays: [starter] }
  }
  return { name: meta?.name || 'Night Yard', plays }
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

export async function savePlaybookName(name: string, seeded = true): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('meta', 'readwrite')
  const record: MetaRecord = { key: 'playbook', name: name.trim() || 'Night Yard', seeded }
  tx.objectStore('meta').put(record)
  await transactionDone(tx)
}
