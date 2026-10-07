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
  const [memoryOnly, setMemoryOnly] = useState(false)
  const playsRef = useRef(plays)
  const historyRef = useRef(history)
  playsRef.current = plays
  historyRef.current = history

  function notify(message: string) {
    setToast(message)
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
        setToast('This browser blocked saving. You can still export a JSON file.')
        setReady(true)
      })
    return () => {
      cancel = true
    }
  }, [])

  const play = history?.present ?? null

  useEffect(() => {
    if (!ready || !play || memoryOnly) return
    const handle = window.setTimeout(() => {
      savePlay(play).catch(() => setToast('Could not save on this device.'))
    }, 280)
    return () => window.clearTimeout(handle)
  }, [play, ready, memoryOnly])

  useEffect(() => {
    if (!toast) return
    const handle = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(handle)
  }, [toast])

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
    if (!memoryOnly) await savePlay(created).catch(() => setToast('Could not save on this device.'))
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
      if (!memoryOnly) await savePlay({ ...renamed, updatedAt: Date.now() }).catch(() => setToast('Could not save on this device.'))
    }
  }

  async function duplicate(id: string) {
    const found = playsRef.current.find((item) => item.id === id)
    if (!found) return
    const copy = duplicatePlay(found)
    if (!memoryOnly) await savePlay(copy).catch(() => setToast('Could not save on this device.'))
    setPlays([copy, ...playsRef.current])
    const next = createHistory(copy)
    historyRef.current = next
    setHistory(next)
    notify(`Duplicated ${found.name}`)
  }

  async function remove(id: string) {
    const remaining = playsRef.current.filter((item) => item.id !== id)
    if (!memoryOnly) await deletePlay(id).catch(() => setToast('Could not delete that play.'))
    setPlays(remaining)
    if (historyRef.current?.present.id === id) {
      const fallback = remaining[0] ?? null
      const next = fallback ? createHistory(fallback) : null
      historyRef.current = next
      setHistory(next)
    }
  }

  async function renameBook(name: string) {
    const trimmed = name.trim() || 'Night Yard'
    setBookName(trimmed)
    if (!memoryOnly) await savePlaybookName(trimmed).catch(() => setToast('Could not rename the playbook.'))
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
    notify(bundle.plays.length === 1 ? `Imported ${bundle.plays[0].name}` : `Imported ${bundle.plays.length} plays`)
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
