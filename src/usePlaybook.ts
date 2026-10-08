import { useEffect, useRef, useState } from 'preact/hooks'
import { commit, createHistory, redo, undo, canRedo, canUndo, type History } from './history'
import { createPlay, duplicatePlay, parseBundle, renamePlay } from './play'
import { deletePlay, loadPlaybook, savePlay, savePlaybookName } from './storage'
import { showcasePlay } from './play'
import type { FormatId, Play } from './types'

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
  const deletedRef = useRef<Play | null>(null)
  const playsRef = useRef(plays)
  const historyRef = useRef(history)
  playsRef.current = plays
  historyRef.current = history

  function notify(message: string, undo?: () => void) {
    setToast(message)
    setToastUndo(() => undo ?? null)
  }

  function publish(next: History) {
    historyRef.current = next
    setHistory(next)
    setPlays(replacePlay(playsRef.current, next.present))
  }

  useEffect(() => {
    let cancel = false
    loadPlaybook()
      .then((loaded) => {
        if (cancel) return
        setBookName(loaded.name)
        setPlays(loaded.plays)
        setHistory(loaded.plays[0] ? createHistory(loaded.plays[0]) : null)
        setReady(true)
      })
      .catch(() => {
        if (cancel) return
        const starter = showcasePlay()
        setPlays([starter])
        setHistory(createHistory(starter))
        setMemoryOnly(true)
        setToast("Can't save on this phone. Use More, then Save a file.")
        setReady(true)
      })
    return () => {
      cancel = true
    }
  }, [])

  const play = history?.present ?? null

  useEffect(() => {
    if (!ready || !play || memoryOnly) return
    setSaved(false)
    const handle = window.setTimeout(() => {
      savePlay(play)
        .then(() => setSaved(true))
        .catch(() => {
          setToast('Could not save on this phone.')
          setToastUndo(() => null)
        })
    }, 280)
    return () => window.clearTimeout(handle)
  }, [play, ready, memoryOnly])

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
  }

  function open(id: string) {
    const found = playsRef.current.find((item) => item.id === id)
    if (!found) return
    const next = createHistory(found)
    historyRef.current = next
    setHistory(next)
  }

  async function create(format: FormatId = '5v5') {
    const created = createPlay({ format, formationId: format === '11v11' ? 'shotgun-trips' : 'doubles', name: nextName(playsRef.current) })
    if (!memoryOnly) await savePlay(created).then(() => setSaved(true)).catch(() => setToast('Could not save on this phone.'))
    setPlays([created, ...playsRef.current])
    const next = createHistory(created)
    historyRef.current = next
    setHistory(next)
  }

  async function rename(id: string, name: string) {
    const found = playsRef.current.find((item) => item.id === id)
    if (!found) return
    const renamed = renamePlay(found, name)
    if (historyRef.current?.present.id === id) update(renamed)
    else {
      setPlays(replacePlay(playsRef.current, { ...renamed, updatedAt: Date.now() }))
      if (!memoryOnly) await savePlay({ ...renamed, updatedAt: Date.now() }).catch(() => setToast('Could not save on this phone.'))
    }
  }

  async function duplicate(id: string) {
    const found = playsRef.current.find((item) => item.id === id)
    if (!found) return
    const copy = duplicatePlay(found)
    if (!memoryOnly) await savePlay(copy).catch(() => setToast('Could not save on this phone.'))
    setPlays([copy, ...playsRef.current])
    const next = createHistory(copy)
    historyRef.current = next
    setHistory(next)
    notify('Made a copy')
  }

  async function remove(id: string) {
    const found = playsRef.current.find((item) => item.id === id)
    if (!found) return
    if (!memoryOnly) {
      try {
        await deletePlay(id)
      } catch {
        notify('Could not delete that play.')
        return
      }
    }
    deletedRef.current = found
    const remaining = playsRef.current.filter((item) => item.id !== id)
    setPlays(remaining)
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
    if (!memoryOnly) {
      try {
        await savePlay(found)
      } catch {
        notify('Could not bring that play back.')
        return
      }
    }
    setPlays(playsRef.current.some((item) => item.id === found.id) ? playsRef.current : [found, ...playsRef.current])
    const next = createHistory(found)
    historyRef.current = next
    setHistory(next)
    notify('Brought it back.')
  }

  async function renameBook(name: string) {
    const trimmed = name.trim() || 'Night Yard'
    setBookName(trimmed)
    if (!memoryOnly) await savePlaybookName(trimmed).catch(() => setToast('Could not rename the plays.'))
  }

  async function importJson(text: string) {
    const bundle = parseBundle(text)
    if (!memoryOnly) {
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

  function doUndo() {
    const current = historyRef.current
    if (!current) return
    publish(undo(current))
  }

  function doRedo() {
    const current = historyRef.current
    if (!current) return
    publish(redo(current))
  }

  return {
    ready,
    plays,
    bookName,
    play,
    toast,
    toastUndo,
    saved,
    notify,
    canUndo: history ? canUndo(history) : false,
    canRedo: history ? canRedo(history) : false,
    update,
    open,
    create,
    rename,
    duplicate,
    remove,
    renameBook,
    importJson,
    undo: doUndo,
    redo: doRedo,
  }
}
