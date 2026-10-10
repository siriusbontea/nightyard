import { useEffect, useState } from 'preact/hooks'
import { PLAY_CATEGORIES, categoryOf, groupPlays, type PlayCategory } from '../categories'
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

export function PlaysSheet(props: {
  plays: Play[]
  current: Play
  signedIn: boolean
  saveStatus: string
  saveKind: string
  onSaveStatus?: () => void
  onCreate: () => void
  onOpen: (play: Play) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onCategory: (category: PlayCategory) => void
  onDownloadPlay: () => void
  onDownloadAll: () => void
  onLoadFile: () => void
  onSignIn: () => void
  onClose: () => void
}) {
  const [server, setServer] = useState<Play[] | null>(null)
  const [offline, setOffline] = useState(false)
  const [filter, setFilter] = useState<PlayCategory | 'All'>('All')
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(props.current.name)

  useEffect(() => {
    setDraft(props.current.name)
    setRenaming(false)
  }, [props.current.id])

  useEffect(() => {
    if (!props.signedIn) {
      setServer(null)
      setOffline(false)
      return
    }
    let cancel = false
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOffline(true)
      setServer(null)
      return
    }
    fetchServerPlays()
      .then((next) => {
        if (!cancel) setServer(next)
      })
      .catch(() => {
        if (!cancel) setOffline(true)
      })
    return () => {
      cancel = true
    }
  }, [props.signedIn])

  const source = server ?? props.plays
  const shown = filterSavedPlays(source, query)
  const groups = groupPlays(shown, filter)
  const search = showsSavedSearch(source.length)

  return (
    <Sheet title="Plays" subtitle={props.signedIn ? 'Saved to your account' : undefined} onClose={props.onClose}>
      <button type="button" class="primary wide" onClick={props.onCreate}>
        New play
      </button>
      <section class="current-play">
        <p class="field-label">This play</p>
        {renaming ? (
          <form
            class="rename-form"
            onSubmit={(event) => {
              event.preventDefault()
              props.onRename(props.current.id, draft)
              setRenaming(false)
            }}
          >
            <input
              aria-label={`Rename ${props.current.name}`}
              value={draft}
              maxLength={80}
              onInput={(event) => setDraft((event.currentTarget as HTMLInputElement).value)}
            />
            <button type="submit" class="text-btn">
              Save
            </button>
          </form>
        ) : (
          <p class="play-name">{props.current.name}</p>
        )}
        {props.saveStatus ? (
          props.onSaveStatus ? (
            <button type="button" class={`save-chip ${props.saveKind}`} onClick={props.onSaveStatus}>
              {props.saveStatus}
            </button>
          ) : (
            <p class={`save-chip static ${props.saveKind}`}>{props.saveStatus}</p>
          )
        ) : null}
        <div class="row-actions">
          <button type="button" class="text-btn" onClick={() => setRenaming(true)}>
            Rename
          </button>
          <button type="button" class="text-btn" onClick={() => props.onDuplicate(props.current.id)}>
            Copy
          </button>
          <button type="button" class="text-btn danger" onClick={() => props.onDelete(props.current.id)}>
            Delete
          </button>
        </div>
        <p class="field-label">Category</p>
        <div class="chips">
          {PLAY_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              class="chip"
              aria-pressed={categoryOf(props.current) === category}
              onClick={() => props.onCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>
      <section>
        <p class="backup-label">Your saved plays</p>
        {props.signedIn ? null : <p class="fine">Sign in to open these on any device.</p>}
        {offline ? <p class="fine">Offline — showing plays on this phone</p> : null}
        {props.signedIn && server === null && !offline ? <p class="fine">Loading your plays…</p> : null}
        <div class="filter-row">
          <button type="button" class="chip" aria-pressed={filter === 'All'} onClick={() => setFilter('All')}>
            All
          </button>
          {PLAY_CATEGORIES.map((category) => (
            <button key={category} type="button" class="chip" aria-pressed={filter === category} onClick={() => setFilter(category)}>
              {category}
            </button>
          ))}
        </div>
        {!props.signedIn ? (
          <button type="button" class="primary wide ghost" onClick={props.onSignIn}>
            Sign in
          </button>
        ) : null}
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
        {groups.length === 0 ? <p class="empty-copy">No plays in {filter === 'All' ? 'this list' : filter}.</p> : null}
        {groups.map((group) => (
          <div key={group.category}>
            <p class="group-label">{group.category}</p>
            <div class="saved-list">
              {group.plays.map((play) => (
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
          </div>
        ))}
      </section>
      <section>
        <p class="backup-label">Backup files</p>
        <button type="button" class="primary wide ghost" onClick={props.onDownloadPlay}>
          Download this play (file)
        </button>
        <button type="button" class="primary wide ghost" onClick={props.onDownloadAll}>
          Download all plays (file)
        </button>
        <button type="button" class="primary wide ghost" onClick={props.onLoadFile}>
          Load a file from this device
        </button>
        <p class="fine">Your plays already save to your account. These make a file on this phone.</p>
      </section>
    </Sheet>
  )
}
