import { useEffect, useRef, useState } from 'preact/hooks'
import { commit, createHistory, redo, undo, canRedo, canUndo, type History } from './history'
import { isGuest } from './guest'
import { createPlay, duplicatePlay, parseBundle, renamePlay, resetPlay, sanitizePlay } from './play'
import { deletePlay, loadPlaybook, savePlay, savePlaybookName } from './storage'
import { showcasePlay } from './play'
import {
  bootSync,
  currentUsername,
  forgetDelete,
  getSyncState,
  rememberDelete,
  saveChip,
  scheduleSync,
  setFreshSeed,
  subscribeSync,
  type SyncState,
} from './sync'
import type { FormatId, Play } from './types'

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
  return JSON.stringify(a) === JSON.stringify(b)
}

function replacePlay(list: Play[], play: Play): Play[] {
  const index = list.findIndex((item) => item.id === play.id)
  if (index < 0) return [play, ...list]
  const next = list.slice()
  next[index] = play
  return next
}

function nextName(plays: Play[]): string {
  const names = new Set(plays.map((play) => play.name))
  if (!names.has('New play')) return 'New play'
  let n = 2
  while (names.has(`New play ${n}`)) n += 1
  return `New play ${n}`
}

export function usePlaybook() {
  const [ready, setReady] = useState(false)
  const [plays, setPlays] = useState<Play[]>([])
  const [bookName, setBookName] = useState('Night Yard')
  const [history, setHistory] = useState<History | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [toastUndo, setToastUndo] = useState<(() => void) | null>(null)
  const [saved, setSaved] = useState(false)
  const [memoryOnly, setMemoryOnly] = useState(false)
  const [guest, setGuest] = useState(false)
  const [account, setAccount] = useState<SyncState>(getSyncState())
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const deletedRef = useRef<Play | null>(null)
  const playsRef = useRef(plays)
  const historyRef = useRef(history)
  const memoryOnlyRef = useRef(false)
  const guestRef = useRef(false)
  const bookNameRef = useRef(bookName)
  const signedRef = useRef(getSyncState().signedIn)
  const tipped = useRef(autosaveTipSeen())
  playsRef.current = plays
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
    historyRef.current = next
    setHistory(next)
    setPlays(replacePlay(playsRef.current, next.present))
  }

  function acceptPlays(next: Play[]) {
    const previous = playsRef.current
    if (keepsLocal()) {
      const ids = new Set(next.map((item) => item.id))
      for (const item of previous) {
        if (!ids.has(item.id)) void deletePlay(item.id)
      }
      for (const item of next) void savePlay(item)
    }
    playsRef.current = next
    setPlays(next)
    const current = historyRef.current
    if (!current) {
      const opened = next[0] ? createHistory(next[0]) : null
      historyRef.current = opened
      setHistory(opened)
      return
    }
    const updated = next.find((item) => item.id === current.present.id) ?? null
    if (updated && (updated === current.present || samePlay(updated, current.present))) return
    const open = updated ?? next[0] ?? null
    const opened = open ? createHistory(open) : null
    historyRef.current = opened
    setHistory(opened)
  }

  useEffect(() => subscribeSync(setAccount), [])

  useEffect(() => {
    let cancel = false
    let stop = () => {}
    const start = () => {
      stop = bootSync({ getPlays: () => playsRef.current, applyPlays: acceptPlays })
    }
    loadPlaybook()
      .then((loaded) => {
        if (cancel) return
        const opened = loaded.plays[0] ? createHistory(loaded.plays[0]) : null
        playsRef.current = loaded.plays
        historyRef.current = opened
        setBookName(loaded.name)
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
        const starter = showcasePlay()
        const opened = createHistory(starter)
        playsRef.current = [starter]
        historyRef.current = opened
        setPlays([starter])
        setHistory(opened)
        memoryOnlyRef.current = true
        setMemoryOnly(true)
        setFreshSeed({ id: starter.id, updatedAt: starter.updatedAt })
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
    setSaved(false)
    const handle = window.setTimeout(() => {
      if (!keepsLocal()) return
      savePlay(play)
        .then(() => {
          setSaved(true)
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
        await savePlaybookName(bookNameRef.current)
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

  async function create(format: FormatId = '11v11') {
    const created = createPlay({
      format,
      formationId: format === '11v11' ? 'shotgun-trips' : undefined,
      name: nextName(playsRef.current),
    })
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
      setPlays(replacePlay(playsRef.current, { ...renamed, updatedAt: Date.now() }))
      if (keepsLocal()) await savePlay({ ...renamed, updatedAt: Date.now() }).catch(() => setToast('Could not save on this phone.'))
    }
  }

  async function duplicate(id: string) {
    const found = playsRef.current.find((item) => item.id === id)
    if (!found) return
    const copy = duplicatePlay(found)
    if (keepsLocal()) await savePlay(copy).catch(() => setToast('Could not save on this phone.'))
    setPlays([copy, ...playsRef.current])
    const next = createHistory(copy)
    historyRef.current = next
    setHistory(next)
    notify('Made a copy')
    maybeAutosaveTip()
  }

  async function remove(id: string) {
    const found = playsRef.current.find((item) => item.id === id)
    if (!found) return
    if (keepsLocal()) {
      try {
        await deletePlay(id)
      } catch {
        notify('Could not delete that play.')
        return
      }
    }
    deletedRef.current = found
    const remaining = playsRef.current.filter((item) => item.id !== id)
    playsRef.current = remaining
    setPlays(remaining)
    if (keepsLocal()) rememberDelete(id)
    if (historyRef.current?.present.id === id) {
      const fallback = remaining[0] ?? null
      const next = fallback ? createHistory(fallback) : null
      historyRef.current = next
      setHistory(next)
    }
    notify('Deleted. Tap Undo.', () => {
      void restoreDeleted()
    })
  }

  async function restoreDeleted() {
    const found = deletedRef.current
    if (!found) return
    deletedRef.current = null
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
    const list = playsRef.current.some((item) => item.id === restored.id)
      ? playsRef.current.map((item) => (item.id === restored.id ? restored : item))
      : [restored, ...playsRef.current]
    playsRef.current = list
    setPlays(list)
    const next = createHistory(restored)
    historyRef.current = next
    setHistory(next)
    notify('Brought it back.')
  }

  async function renameBook(name: string) {
    const trimmed = name.trim() || 'Night Yard'
    setBookName(trimmed)
    if (keepsLocal()) await savePlaybookName(trimmed).catch(() => setToast('Could not rename the plays.'))
  }

  async function openSaved(incoming: Play) {
    const play = sanitizePlay(incoming)
    if (!play) return
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

  async function importJson(text: string) {
    const bundle = parseBundle(text)
    if (keepsLocal()) {
      for (const item of bundle.plays) await savePlay(item)
      if (playsRef.current.length === 0 && bundle.kind === 'playbook') await savePlaybookName(bundle.name)
    }
    const merged = [...playsRef.current]
    for (const item of bundle.plays) {
      const index = merged.findIndex((play) => play.id === item.id)
      if (index >= 0) merged[index] = item
      else merged.unshift(item)
    }
    setPlays(merged)
    if (bundle.kind === 'playbook' && playsRef.current.length === 0) setBookName(bundle.name)
    const next = createHistory(bundle.plays[0])
    historyRef.current = next
    setHistory(next)
    notify(bundle.plays.length === 1 ? `Opened ${bundle.plays[0].name}` : `Opened ${bundle.plays.length} plays`)
  }

  function reset() {
    const current = historyRef.current
    if (!current) return
    const restored = resetPlay(current.present)
    const next = createHistory(restored)
    historyRef.current = next
    setHistory(next)
    setPlays(replacePlay(playsRef.current, restored))
  }

  function stampHistory(next: History): History {
    return { ...next, present: { ...next.present, updatedAt: Date.now() } }
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

  return {
    ready,
    plays,
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
    importJson,
    openSaved,
    undo: doUndo,
    redo: doRedo,
  }
}
