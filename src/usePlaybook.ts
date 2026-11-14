import { useEffect, useRef, useState } from 'preact/hooks'
import { commit, createHistory, redo, undo, canRedo, canUndo, type History } from './history'
import { isGuest, showWelcomeAgain } from './guest'
import { sameJson } from './jsonEqual'
import { formationById } from './formations'
import { numberedName } from './playNames'
import { createPlay, duplicatePlay, emptyBookStarters, parseBundle, renamePlay, resetPlay, sanitizePlay } from './play'
import { adoptOwnerBook, copyName, emptyPlaybook, movePlay, playsInBook, renamePlaybook } from './playbooks'
import { clearLocalBook, deletePlay, deletePlaybookRecord, loadPlaybook, saveCurrentBookId, savePlay, savePlaybookName, savePlaybookRecord } from './storage'
import {
  bootSync,
  currentUsername,
  forgetDelete,
  getSyncState,
  rememberBookDelete,
  rememberDelete,
  saveChip,
  scheduleSync,
  setFreshSeed,
  subscribeSync,
  type SyncState,
} from './sync'
import { clearTombstones, loadTombstones } from './tombstones'
import { clearUnsavedIfCurrent, setUndoHold, setUnsavedWork, unsavedGeneration } from './updateGate'
import type { FormatId, Play, Playbook } from './types'

const AUTOSAVE_TIP = 'night-yard-autosave-tip'

function autosaveTipSeen(): boolean {
  try {
    return localStorage.getItem(AUTOSAVE_TIP) === '1'
  } catch {
    return false
  }
}

function markAutosaveTip() {
  try {
    localStorage.setItem(AUTOSAVE_TIP, '1')
  } catch {
    /* private mode */
  }
}

function samePlay(a: Play, b: Play): boolean {
  return sameJson(a, b)
}

function replacePlay(list: Play[], play: Play): Play[] {
  const index = list.findIndex((item) => item.id === play.id)
  if (index < 0) return [play, ...list]
  const next = list.slice()
  next[index] = play
  return next
}

function freshPlayName(format: FormatId, plays: Play[]): string {
  const formationId = format === '11v11' ? 'shotgun-trips' : formationById(format, '').id
  return numberedName(
    plays.map((play) => play.name),
    formationById(format, formationId).name,
  )
}

export function usePlaybook() {
  const [ready, setReady] = useState(false)
  const [plays, setPlays] = useState<Play[]>([])
  const [books, setBooks] = useState<Playbook[]>([])
  const [currentId, setCurrentId] = useState('')
  const [bookName, setBookName] = useState('Night Yard')
  const [history, setHistory] = useState<History | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [toastUndo, setToastUndo] = useState<(() => void) | null>(null)
  const [saved, setSaved] = useState(false)
  const [memoryOnly, setMemoryOnly] = useState(false)
  const [guest, setGuest] = useState(false)
  const [account, setAccount] = useState<SyncState>(getSyncState())
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const deletedRef = useRef<{ play: Play; index: number } | null>(null)
  const savedPlay = useRef<Play | null>(null)
  const playsRef = useRef(plays)
  const historyRef = useRef(history)
  const memoryOnlyRef = useRef(false)
  const guestRef = useRef(false)
  const bookNameRef = useRef(bookName)
  const bookNamedAtRef = useRef(0)
  const booksRef = useRef(books)
  const currentIdRef = useRef(currentId)
  const accountNameRef = useRef('Night Yard')
  const mirrorIdRef = useRef('')
  const signedRef = useRef(getSyncState().signedIn)
  const tipped = useRef(autosaveTipSeen())
  playsRef.current = plays
  booksRef.current = books
  currentIdRef.current = currentId
  historyRef.current = history
  memoryOnlyRef.current = memoryOnly
  guestRef.current = guest
  bookNameRef.current = bookName

  function keepsLocal(): boolean {
    return !memoryOnlyRef.current && !guestRef.current
  }

  function notify(message: string, undo?: () => void) {
    setToast(message)
    setToastUndo(() => undo ?? null)
    setUndoHold(Boolean(undo))
  }

  function maybeAutosaveTip() {
    if (tipped.current || guestRef.current || !getSyncState().signedIn) return
    tipped.current = true
    markAutosaveTip()
    notify('Plays save to your account automatically.')
  }

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  function publish(next: History) {
    setUnsavedWork(true)
    historyRef.current = next
    setHistory(next)
    setPlays(replacePlay(playsRef.current, next.present))
  }

  function visiblePlays(list: Play[], bookId = currentIdRef.current): Play[] {
    return list.filter((item) => item.bookId === bookId)
  }

  function openHistory(play: Play | null) {
    const opened = play ? createHistory(play) : null
    historyRef.current = opened
    setHistory(opened)
  }

  function acceptPlays(next: Play[]) {
    const tombs = loadTombstones()
    const kept = next.filter((play) => {
      const stamp = tombs.find((item) => item.playId === play.id)?.updatedAt
      return stamp === undefined || play.updatedAt > stamp
    })
    const current = historyRef.current
    const updated = current ? (kept.find((item) => item.id === current.present.id) ?? null) : null
    const openSame =
      !current ||
      (updated !== null && updated.bookId === currentIdRef.current && (updated === current.present || samePlay(updated, current.present)))
    if (sameJson(kept, playsRef.current) && openSame) return
    const previous = playsRef.current
    if (keepsLocal()) {
      const ids = new Set(kept.map((item) => item.id))
      for (const item of previous) {
        if (!ids.has(item.id)) void deletePlay(item.id)
      }
      for (const item of kept) void savePlay(item)
    }
    playsRef.current = kept
    setPlays(kept)
    if (!current) {
      openHistory(visiblePlays(kept)[0] ?? null)
      return
    }
    if (openSame) return
    const open = updated && updated.bookId === currentIdRef.current ? updated : (visiblePlays(kept)[0] ?? null)
    openHistory(open)
    if (open) savedPlay.current = open
  }

  function applyBooks(next: Playbook[], wanted: string) {
    const previous = booksRef.current
    const id = next.some((book) => book.id === wanted) ? wanted : (next[0]?.id ?? '')
    const ids = new Set(next.map((book) => book.id))
    const orphans = Boolean(id) && playsRef.current.some((play) => !play.bookId || !ids.has(play.bookId))
    if (!orphans && sameJson(next, previous) && id === currentIdRef.current) return
    booksRef.current = next
    currentIdRef.current = id
    setBooks(next)
    setCurrentId(id)
    const current = next.find((book) => book.id === id)
    if (current) setBookName(current.name)
    if (keepsLocal()) {
      void (async () => {
        for (const old of previous) {
          if (!next.some((book) => book.id === old.id)) await deletePlaybookRecord(old.id)
        }
        for (const book of next) await savePlaybookRecord(book)
        if (id) await saveCurrentBookId(id)
      })()
    }
    const open = historyRef.current
    if (open && open.present.bookId !== id) openHistory(visiblePlays(playsRef.current, id)[0] ?? null)
    if (!id || !playsRef.current.some((play) => !play.bookId || !ids.has(play.bookId))) return
    const now = Date.now()
    const fixed = playsRef.current.map((play) =>
      play.bookId && ids.has(play.bookId) ? play : { ...play, bookId: id, updatedAt: Math.max(play.updatedAt, now) },
    )
    const changed = fixed.filter((play, index) => play !== playsRef.current[index])
    playsRef.current = fixed
    setPlays(fixed)
    if (!keepsLocal()) return
    for (const play of changed) void savePlay(play)
  }

  useEffect(() => subscribeSync(setAccount), [])

  useEffect(() => {
    let cancel = false
    let stop = () => {}
    const start = () => {
      stop = bootSync({
        getPlays: () => playsRef.current,
        applyPlays: acceptPlays,
        getBooks: () => booksRef.current,
        getCurrentBookId: () => currentIdRef.current,
        applyBooks,
        adoptOwner: (ownerId) => {
          const adopted = adoptOwnerBook(booksRef.current, playsRef.current, ownerId)
          if (!adopted.changed) return
          const previousId = booksRef.current[0]?.id
          booksRef.current = adopted.books
          playsRef.current = adopted.plays
          setBooks(adopted.books)
          setPlays(adopted.plays)
          const nextId = adopted.books[0]?.id ?? ''
          if (currentIdRef.current === previousId) {
            currentIdRef.current = nextId
            setCurrentId(nextId)
          }
          if (mirrorIdRef.current === previousId) mirrorIdRef.current = nextId
          if (!keepsLocal()) return
          void (async () => {
            if (previousId) await deletePlaybookRecord(previousId)
            for (const book of adopted.books) await savePlaybookRecord(book)
            for (const play of adopted.plays) await savePlay(play)
            if (currentIdRef.current) await saveCurrentBookId(currentIdRef.current)
          })()
        },
        getBookName: () => ({ name: accountNameRef.current || bookNameRef.current, namedAt: bookNamedAtRef.current }),
        applyBookName: (name, namedAt) => {
          bookNamedAtRef.current = namedAt
          accountNameRef.current = name
          const id = mirrorIdRef.current || currentIdRef.current
          const next = booksRef.current.map((book) => (book.id === id && book.name !== name ? renamePlaybook(book, name, Math.max(book.updatedAt, namedAt)) : book))
          booksRef.current = next
          setBooks(next)
          if (currentIdRef.current === id) setBookName(name)
          if (!keepsLocal()) return
          void savePlaybookName(name, true, namedAt)
          const changed = next.find((book) => book.id === id)
          if (changed) void savePlaybookRecord(changed)
        },
      })
    }
    loadPlaybook()
      .then((loaded) => {
        if (cancel) return
        const first = loaded.plays.find((item) => item.bookId === loaded.currentId) ?? null
        const opened = first ? createHistory(first) : null
        playsRef.current = loaded.plays
        booksRef.current = loaded.books
        currentIdRef.current = loaded.currentId
        mirrorIdRef.current = loaded.currentId
        accountNameRef.current = loaded.name
        historyRef.current = opened
        bookNamedAtRef.current = loaded.namedAt
        setBookName(loaded.name)
        setBooks(loaded.books)
        setCurrentId(loaded.currentId)
        setPlays(loaded.plays)
        setHistory(opened)
        const nextGuest = isGuest(Boolean(currentUsername()), loaded.legacy)
        guestRef.current = nextGuest
        setGuest(nextGuest)
        setReady(true)
        setFreshSeed(loaded.freshSeed)
        start()
      })
      .catch(() => {
        if (cancel) return
        const book = emptyPlaybook('Night Yard')
        const starters = emptyBookStarters()
        for (const play of starters.plays) play.bookId = book.id
        const opened = createHistory(starters.seed)
        const seeded = starters.plays.sort((a, b) => b.updatedAt - a.updatedAt)
        playsRef.current = seeded
        booksRef.current = [book]
        currentIdRef.current = book.id
        mirrorIdRef.current = book.id
        accountNameRef.current = book.name
        historyRef.current = opened
        setPlays(seeded)
        setBooks([book])
        setCurrentId(book.id)
        setBookName(book.name)
        setHistory(opened)
        memoryOnlyRef.current = true
        setMemoryOnly(true)
        setFreshSeed({ id: starters.seed.id, updatedAt: starters.seed.updatedAt })
        setToast("Can't save on this phone. Use More, then Save a file.")
        setReady(true)
        start()
      })
    return () => {
      cancel = true
      stop()
    }
  }, [])

  const play = history?.present ?? null

  useEffect(() => {
    if (!ready || !play || memoryOnly || guest || guestRef.current) return
    if (savedPlay.current && samePlay(savedPlay.current, play)) {
      setSaved(true)
      setUnsavedWork(false)
      return
    }
    if (!savedPlay.current) {
      savedPlay.current = play
      return
    }
    setSaved(false)
    const seen = unsavedGeneration()
    const handle = window.setTimeout(() => {
      const current = historyRef.current?.present
      if (!current || !keepsLocal()) return
      if (savedPlay.current && samePlay(savedPlay.current, current)) return
      savePlay(current)
        .then(() => {
          savedPlay.current = current
          setSaved(true)
          clearUnsavedIfCurrent(seen)
          scheduleSync()
        })
        .catch(() => {
          setToast('Could not save on this phone.')
          setToastUndo(() => null)
        })
    }, 280)
    return () => window.clearTimeout(handle)
  }, [play, ready, memoryOnly, guest])

  useEffect(() => {
    if (!ready || !account.signedIn || !guest) return
    let cancel = false
    const plays = playsRef.current
    void (async () => {
      try {
        for (const item of plays) await savePlay(item)
        for (const item of booksRef.current) await savePlaybookRecord(item)
        if (currentIdRef.current) await saveCurrentBookId(currentIdRef.current)
        await savePlaybookName(accountNameRef.current || bookNameRef.current, true, bookNamedAtRef.current)
        if (cancel) return
        guestRef.current = false
        setGuest(false)
        scheduleSync()
      } catch {
        if (!cancel) setToast('Could not save on this phone.')
      }
    })()
    return () => {
      cancel = true
    }
  }, [account.signedIn, ready, guest])

  useEffect(() => {
    if (!ready) return
    if (account.signedIn && !signedRef.current && playsRef.current.length > 0) {
      notify('Your plays are on your account.')
    }
    signedRef.current = account.signedIn
  }, [account.signedIn, ready])

  useEffect(() => {
    setUndoHold(Boolean(toast && toastUndo))
    if (!toast) return
    const handle = window.setTimeout(() => {
      setToast(null)
      setToastUndo(() => null)
    }, toastUndo ? 6000 : 2800)
    return () => window.clearTimeout(handle)
  }, [toast, toastUndo])

  function update(next: Play) {
    const current = historyRef.current
    if (!current) return
    publish(commit(current, next))
    maybeAutosaveTip()
  }

  function open(id: string) {
    const found = playsRef.current.find((item) => item.id === id)
    if (!found) return
    const next = createHistory(found)
    historyRef.current = next
    setHistory(next)
  }

  async function create(format: FormatId = '11v11', los?: number) {
    if (!keepsLocal()) setUnsavedWork(true)
    const bookId = currentIdRef.current || booksRef.current[0]?.id
    if (!bookId) return
    const created = createPlay({
      format,
      formationId: format === '11v11' ? 'shotgun-trips' : undefined,
      name: freshPlayName(format, visiblePlays(playsRef.current, bookId)),
      los,
    })
    created.bookId = bookId
    let failed = false
    if (keepsLocal()) {
      await savePlay(created)
        .then(() => setSaved(true))
        .catch(() => {
          failed = true
          setToast('Could not save on this phone.')
        })
    }
    setPlays([created, ...playsRef.current])
    const next = createHistory(created)
    historyRef.current = next
    setHistory(next)
    if (!failed) maybeAutosaveTip()
  }

  async function rename(id: string, name: string) {
    const found = playsRef.current.find((item) => item.id === id)
    if (!found) return
    const renamed = renamePlay(found, name)
    if (historyRef.current?.present.id === id) update(renamed)
    else {
      if (!keepsLocal()) setUnsavedWork(true)
      setPlays(replacePlay(playsRef.current, { ...renamed, updatedAt: Date.now() }))
      if (keepsLocal()) await savePlay({ ...renamed, updatedAt: Date.now() }).catch(() => setToast('Could not save on this phone.'))
    }
  }

  async function duplicate(id: string) {
    const found = playsRef.current.find((item) => item.id === id)
    if (!found) return
    const copy = duplicatePlay(found)
    if (!keepsLocal()) setUnsavedWork(true)
    if (keepsLocal()) await savePlay(copy).catch(() => setToast('Could not save on this phone.'))
    setPlays([copy, ...playsRef.current])
    const next = createHistory(copy)
    historyRef.current = next
    setHistory(next)
    notify('Made a copy')
    maybeAutosaveTip()
  }

  async function remove(id: string) {
    const index = playsRef.current.findIndex((item) => item.id === id)
    const found = index >= 0 ? playsRef.current[index] : undefined
    if (!found) return
    if (!keepsLocal()) setUnsavedWork(true)
    deletedRef.current = { play: found, index }
    const remaining = playsRef.current.filter((item) => item.id !== id)
    playsRef.current = remaining
    setPlays(remaining)
    const deletingOpen = historyRef.current?.present.id === id
    if (keepsLocal()) {
      rememberDelete(id, Math.max(Date.now(), found.updatedAt + 1))
      void deletePlay(id).catch(() => notify('Could not delete that play.'))
    }
    if (deletingOpen) {
      const source = found.bookId ?? currentIdRef.current
      const sibling = remaining.find((item) => item.bookId === source)
      if (sibling) {
        savedPlay.current = sibling
        openHistory(sibling)
      } else await create()
    }
    notify('Deleted. Tap Undo.', () => {
      void restoreDeleted()
    })
  }

  async function restoreDeleted() {
    const saved = deletedRef.current
    if (!saved) return
    deletedRef.current = null
    const found = saved.play
    const restored = { ...found, updatedAt: Date.now() }
    if (keepsLocal()) {
      try {
        await savePlay(restored)
      } catch {
        notify('Could not bring that play back.')
        return
      }
      forgetDelete(restored.id)
      scheduleSync()
    }
    const list = playsRef.current.filter((item) => item.id !== restored.id)
    list.splice(Math.min(saved.index, list.length), 0, restored)
    playsRef.current = list
    setPlays(list)
    savedPlay.current = restored
    const next = createHistory(restored)
    historyRef.current = next
    setHistory(next)
    notify('Brought it back.')
  }

  async function rememberBook(book: Playbook) {
    const next = booksRef.current.some((item) => item.id === book.id)
      ? booksRef.current.map((item) => (item.id === book.id ? book : item))
      : [book, ...booksRef.current]
    booksRef.current = next
    setBooks(next)
    if (book.id === currentIdRef.current) setBookName(book.name)
    if (!keepsLocal()) return
    await savePlaybookRecord(book)
    scheduleSync()
  }

  function useBook(id: string) {
    const book = booksRef.current.find((item) => item.id === id)
    if (!book) return
    currentIdRef.current = id
    setCurrentId(id)
    setBookName(book.name)
    openHistory(visiblePlays(playsRef.current, id)[0] ?? null)
    if (keepsLocal()) void saveCurrentBookId(id)
  }

  async function renameBook(id: string, name: string) {
    const found = booksRef.current.find((item) => item.id === id)
    if (!found) return
    const renamed = renamePlaybook(found, name)
    try {
      if (id === mirrorIdRef.current || booksRef.current.length === 1) {
        const namedAt = Date.now()
        bookNamedAtRef.current = namedAt
        accountNameRef.current = renamed.name
        mirrorIdRef.current = id
        if (keepsLocal()) await savePlaybookName(renamed.name, true, namedAt)
      }
      await rememberBook(renamed)
    } catch {
      setToast('Could not rename the playbook.')
    }
  }

  async function createBook() {
    if (guestRef.current) return false
    const book = emptyPlaybook('New playbook')
    const starter = createPlay({ format: '11v11', formationId: 'shotgun-trips', name: numberedName([], 'Shotgun Trips') })
    starter.bookId = book.id
    try {
      if (keepsLocal()) {
        await savePlaybookRecord(book)
        await savePlay(starter)
        await saveCurrentBookId(book.id)
      }
    } catch {
      setToast('Could not save on this phone.')
      return false
    }
    playsRef.current = [starter, ...playsRef.current]
    setPlays(playsRef.current)
    await rememberBook(book)
    useBook(book.id)
    maybeAutosaveTip()
    return true
  }

  async function copyBook(id: string) {
    if (guestRef.current) return false
    const source = booksRef.current.find((item) => item.id === id)
    if (!source) return false
    const book = emptyPlaybook(copyName(source.name))
    const data = { ...source.data }
    delete data.migrated
    book.data = data
    let copies = playsInBook(playsRef.current, id).map((play) => {
      const copy = duplicatePlay(play)
      return { ...copy, name: play.name, bookId: book.id }
    })
    if (copies.length === 0) {
      const starter = createPlay({ format: '11v11', formationId: 'shotgun-trips', name: numberedName([], 'Shotgun Trips') })
      copies = [{ ...starter, bookId: book.id }]
    }
    try {
      if (keepsLocal()) {
        await savePlaybookRecord(book)
        for (const play of copies) await savePlay(play)
        await saveCurrentBookId(book.id)
      }
    } catch {
      setToast('Could not save on this phone.')
      return false
    }
    playsRef.current = [...copies, ...playsRef.current]
    setPlays(playsRef.current)
    await rememberBook(book)
    useBook(book.id)
    notify('Made a copy')
    maybeAutosaveTip()
    return true
  }

  async function deleteBook(id: string) {
    if (booksRef.current.length <= 1) {
      notify('Keep one playbook.')
      return
    }
    const victims = playsInBook(playsRef.current, id)
    if (keepsLocal()) {
      try {
        for (const play of victims) await deletePlay(play.id)
        await deletePlaybookRecord(id)
      } catch {
        notify('Could not delete that playbook.')
        return
      }
    }
    const now = Date.now()
    const remainingPlays = playsRef.current.filter((play) => play.bookId !== id)
    const remainingBooks = booksRef.current.filter((book) => book.id !== id)
    playsRef.current = remainingPlays
    booksRef.current = remainingBooks
    setPlays(remainingPlays)
    setBooks(remainingBooks)
    if (mirrorIdRef.current === id) mirrorIdRef.current = remainingBooks[0]?.id ?? ''
    if (currentIdRef.current === id) {
      const nextBook = remainingBooks[0]
      currentIdRef.current = nextBook?.id ?? ''
      setCurrentId(currentIdRef.current)
      if (nextBook) setBookName(nextBook.name)
      openHistory(nextBook ? (remainingPlays.find((play) => play.bookId === nextBook.id) ?? null) : null)
      if (keepsLocal() && nextBook) await saveCurrentBookId(nextBook.id).catch(() => undefined)
    } else if (historyRef.current && victims.some((play) => play.id === historyRef.current?.present.id)) {
      openHistory(visiblePlays(remainingPlays)[0] ?? null)
    }
    if (keepsLocal()) {
      for (const play of victims) rememberDelete(play.id, now)
      rememberBookDelete(id, now)
    }
    notify('Playbook deleted.')
  }

  async function copyPlayTo(id: string, bookId: string) {
    const found = playsRef.current.find((item) => item.id === id)
    const target = booksRef.current.find((item) => item.id === bookId)
    if (!found || !target || found.bookId === bookId) return
    const copy = duplicatePlay(found)
    const placed = { ...copy, name: found.name, bookId }
    if (keepsLocal()) {
      try {
        await savePlay(placed)
      } catch {
        notify('Could not save on this phone.')
        return
      }
      scheduleSync()
    }
    playsRef.current = [placed, ...playsRef.current]
    setPlays(playsRef.current)
    notify(`Copied to ${target.name}`)
    maybeAutosaveTip()
  }

  async function movePlayTo(id: string, bookId: string) {
    const found = playsRef.current.find((item) => item.id === id)
    const target = booksRef.current.find((item) => item.id === bookId)
    if (!found || !target || found.bookId === bookId) return
    const sourceId = found.bookId
    const moved = movePlay(found, bookId)
    if (keepsLocal()) {
      try {
        await savePlay(moved)
      } catch {
        notify('Could not save on this phone.')
        return
      }
      scheduleSync()
    }
    const list = replacePlay(playsRef.current, moved)
    playsRef.current = list
    setPlays(list)
    if (historyRef.current?.present.id === id) {
      openHistory(list.find((play) => play.bookId === sourceId) ?? null)
    }
    notify(`Moved to ${target.name}`)
    maybeAutosaveTip()
  }

  async function openSaved(incoming: Play) {
    const play = sanitizePlay(incoming)
    if (!play) return
    if (!play.bookId) play.bookId = currentIdRef.current || booksRef.current[0]?.id
    if (keepsLocal()) {
      try {
        await savePlay(play)
      } catch {
        notify('Could not save on this phone.')
        return
      }
    }
    const merged = playsRef.current.some((item) => item.id === play.id)
      ? playsRef.current.map((item) => (item.id === play.id ? play : item))
      : [play, ...playsRef.current]
    playsRef.current = merged
    setPlays(merged)
    const next = createHistory(play)
    historyRef.current = next
    setHistory(next)
    notify(`Opened ${play.name}`)
  }

  async function importJson(text: string): Promise<'account' | 'ok'> {
    const bundle = parseBundle(text)
    if (bundle.createBook) {
      if (guestRef.current) return 'account'
      const book = emptyPlaybook(bundle.name)
      const copies = bundle.plays.map((play) => {
        const copy = duplicatePlay(play)
        return { ...copy, name: play.name, bookId: book.id }
      })
      if (keepsLocal()) {
        await savePlaybookRecord(book)
        for (const play of copies) await savePlay(play)
        await saveCurrentBookId(book.id)
      }
      playsRef.current = [...copies, ...playsRef.current]
      setPlays(playsRef.current)
      await rememberBook(book)
      useBook(book.id)
      notify(`Opened ${book.name}`)
      maybeAutosaveTip()
      return 'ok'
    }
    const bookId = currentIdRef.current || booksRef.current[0]?.id || ''
    if (!keepsLocal()) setUnsavedWork(true)
    const stamped = bundle.plays.map((play) => ({ ...play, bookId, updatedAt: Date.now() }))
    if (keepsLocal()) {
      for (const item of stamped) await savePlay(item)
    }
    const merged = [...playsRef.current]
    for (const item of stamped) {
      const index = merged.findIndex((play) => play.id === item.id)
      if (index >= 0) merged[index] = item
      else merged.unshift(item)
    }
    playsRef.current = merged
    setPlays(merged)
    if (bookId) useBook(bookId)
    else openHistory(stamped[0] ?? null)
    if (keepsLocal()) scheduleSync()
    notify(stamped.length === 1 ? `Opened ${stamped[0].name}` : `Opened ${stamped.length} plays`)
    return 'ok'
  }

  async function forgetAccount() {
    try {
      await clearLocalBook()
    } catch {
      /* The phone copy can already be gone. The screen still returns to a guest book. */
    }
    clearTombstones()
    showWelcomeAgain()
    const fresh = emptyPlaybook('Night Yard')
    const starters = emptyBookStarters()
    for (const play of starters.plays) play.bookId = fresh.id
    const seeded = starters.plays.sort((a, b) => b.updatedAt - a.updatedAt)
    playsRef.current = seeded
    booksRef.current = [fresh]
    currentIdRef.current = fresh.id
    mirrorIdRef.current = fresh.id
    accountNameRef.current = fresh.name
    bookNamedAtRef.current = 0
    guestRef.current = true
    memoryOnlyRef.current = false
    const opened = createHistory(starters.seed)
    historyRef.current = opened
    savedPlay.current = null
    deletedRef.current = null
    setUnsavedWork(false)
    setUndoHold(false)
    setPlays(seeded)
    setBooks([fresh])
    setCurrentId(fresh.id)
    setBookName(fresh.name)
    setHistory(opened)
    setGuest(true)
    setMemoryOnly(false)
    setSaved(false)
    setFreshSeed({ id: starters.seed.id, updatedAt: starters.seed.updatedAt })
  }

  function reset() {
    const current = historyRef.current
    if (!current) return
    setUnsavedWork(true)
    const restored = resetPlay(current.present)
    const next = createHistory(restored)
    historyRef.current = next
    setHistory(next)
    setPlays(replacePlay(playsRef.current, restored))
  }

  function stampHistory(next: History): History {
    return { ...next, present: { ...next.present, updatedAt: Date.now() } }
  }

  async function flushSave() {
    const current = historyRef.current?.present
    if (!current || !keepsLocal()) return
    if (savedPlay.current && samePlay(savedPlay.current, current)) return
    await savePlay(current)
    savedPlay.current = current
    setSaved(true)
    setUnsavedWork(false)
  }

  function doUndo() {
    const current = historyRef.current
    if (!current || !canUndo(current)) return
    publish(stampHistory(undo(current)))
    maybeAutosaveTip()
  }

  function doRedo() {
    const current = historyRef.current
    if (!current || !canRedo(current)) return
    publish(stampHistory(redo(current)))
    maybeAutosaveTip()
  }

  const shown = currentId ? plays.filter((item) => item.bookId === currentId) : plays

  return {
    ready,
    plays: shown,
    allPlays: plays,
    books,
    currentBookId: currentId,
    bookName,
    play,
    toast,
    toastUndo,
    saved,
    accountName: account.username,
    guest,
    syncStatus: saveChip(saved, account, online, guest).label,
    saveKind: saveChip(saved, account, online, guest).kind,
    notify,
    flushSave,
    countInBook: (id: string) => plays.filter((item) => item.bookId === id).length,
    canUndo: history ? canUndo(history) : false,
    canRedo: history ? canRedo(history) : false,
    update,
    open,
    create,
    rename,
    duplicate,
    remove,
    reset,
    renameBook,
    createBook,
    copyBook,
    deleteBook,
    switchBook: useBook,
    copyPlayTo,
    movePlayTo,
    importJson,
    openSaved,
    undo: doUndo,
    redo: doRedo,
    forgetAccount,
  }
}
