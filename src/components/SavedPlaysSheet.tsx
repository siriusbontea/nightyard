import { useEffect, useRef, useState } from 'preact/hooks'
import { fetchServerPlays, filterSavedPlays, playThumb, showsSavedSearch } from '../savedPlays'
import type { Play } from '../types'
import { formatShort } from '../types'
import { Sheet } from './Sheets'

function age(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000)
  if (seconds < 15) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function SavedPlaysSheet(props: {
  signedIn: boolean
  phonePlays: Play[]
  onOpen: (play: Play) => void
  onSignIn: () => void
  onCreateAccount: () => void
  onFile: () => void
  onClose: () => void
}) {
  const [plays, setPlays] = useState<Play[]>([])
  const [mode, setMode] = useState<'loading' | 'ready' | 'offline' | 'signed-out'>('loading')
  const [query, setQuery] = useState('')
  const phoneRef = useRef(props.phonePlays)
  phoneRef.current = props.phonePlays

  useEffect(() => {
    let cancel = false
    setQuery('')
    if (!props.signedIn) {
      setPlays([])
      setMode('signed-out')
      return
    }
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    if (offline) {
      setPlays(phoneRef.current)
      setMode('offline')
      return
    }
    setMode('loading')
    fetchServerPlays()
      .then((next) => {
        if (cancel) return
        setPlays(next)
        setMode('ready')
      })
      .catch(() => {
        if (cancel) return
        setPlays(phoneRef.current)
        setMode('offline')
      })
    return () => {
      cancel = true
    }
  }, [props.signedIn])

  const shown = filterSavedPlays(plays, query)
  const search = mode !== 'signed-out' && showsSavedSearch(plays.length)

  return (
    <Sheet title="Saved plays" onClose={props.onClose}>
      <div class="saved-sheet">
        <div class="saved-scroll">
          {mode === 'signed-out' ? <p class="welcome-copy">Sign in to see your saved plays</p> : null}
          {mode === 'loading' ? <p class="fine">Loading your plays…</p> : null}
          {mode === 'offline' ? <p class="fine">Offline — showing plays on this phone</p> : null}
          {mode !== 'signed-out' && mode !== 'loading' && plays.length === 0 ? <p class="welcome-copy">No saved plays yet.</p> : null}
          {search ? (
            <label class="field-label">
              Find a play
              <input
                value={query}
                aria-label="Find a play"
                onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
              />
            </label>
          ) : null}
          {mode === 'signed-out' ? (
            <div class="stack">
              <button type="button" class="primary wide welcome-btn" onClick={props.onSignIn}>
                Sign in
              </button>
              <button type="button" class="primary wide ghost welcome-btn" onClick={props.onCreateAccount}>
                Make free account
              </button>
            </div>
          ) : null}
          {shown.length > 0 ? (
            <div class="saved-list">
              {shown.map((play) => (
                <button key={play.id} type="button" class="saved-row" onClick={() => props.onOpen(play)}>
                  <span class="saved-thumb" dangerouslySetInnerHTML={{ __html: playThumb(play) }} />
                  <span class="saved-copy">
                    <span class="play-name">{play.name}</span>
                    <span class="play-meta">
                      {formatShort(play.format)} · {age(play.updatedAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {search && query.trim() && shown.length === 0 ? <p class="fine">No plays with that name.</p> : null}
        </div>
        <button type="button" class="primary wide ghost saved-file" onClick={props.onFile}>
          Load a file from this device
        </button>
      </div>
    </Sheet>
  )
}
