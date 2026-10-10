import { useState } from 'preact/hooks'
import { PLAY_CATEGORIES, groupPlays, type PlayCategory } from '../categories'
import type { Play } from '../types'
import { formatShort } from '../types'

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

export function PlaybookList(props: {
  plays: Play[]
  currentId: string | null
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onCreate: () => void
  onImport?: () => void
  saveStatus?: string
  saveKind?: string
  onSaveStatus?: () => void
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState<PlayCategory | 'All'>('All')
  const groups = groupPlays(props.plays, filter)

  return (
    <div class="book-list">
      <div class="book-actions">
        <button type="button" class="primary" onClick={props.onCreate}>
          New play
        </button>
        {props.onImport ? (
          <button type="button" class="primary ghost" onClick={props.onImport}>
            Open a saved play
          </button>
        ) : null}
      </div>
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
      {props.plays.length === 0 ? (
        <p class="empty-copy">No plays yet. Tap New play.</p>
      ) : (
        groups.map((group) => (
          <div key={group.category}>
            <p class="group-label">{group.category}</p>
            <ul>
          {group.plays.map((play) => {
            const current = play.id === props.currentId
            return (
              <li key={play.id} class={current ? 'play-row current' : 'play-row'}>
                {renaming === play.id ? (
                  <form
                    class="rename-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      props.onRename(play.id, draft)
                      setRenaming(null)
                    }}
                  >
                    <input
                      aria-label={`Rename ${play.name}`}
                      value={draft}
                      maxLength={80}
                      onInput={(event) => setDraft((event.currentTarget as HTMLInputElement).value)}
                    />
                    <button type="submit" class="text-btn">
                      Save
                    </button>
                  </form>
                ) : (
                  <button type="button" class="play-open" onClick={() => props.onOpen(play.id)}>
                    <span class="play-name">{play.name}</span>
                    <span class="play-meta">
                      {play.formation} · {formatShort(play.format)} · {age(play.updatedAt)}
                    </span>
                  </button>
                )}
                {current && props.saveStatus ? (
                  props.onSaveStatus ? (
                    <button type="button" class={`save-chip ${props.saveKind ?? ''} play-save`} onClick={props.onSaveStatus}>
                      {props.saveStatus}
                    </button>
                  ) : (
                    <p class={`save-chip static ${props.saveKind ?? ''} play-save`}>{props.saveStatus}</p>
                  )
                ) : null}
                <div class="row-actions">
                  <button
                    type="button"
                    class="text-btn"
                    onClick={() => {
                      setRenaming(play.id)
                      setDraft(play.name)
                    }}
                  >
                    Rename
                  </button>
                  <button type="button" class="text-btn" onClick={() => props.onDuplicate(play.id)}>
                    Copy
                  </button>
                  <button type="button" class="text-btn danger" onClick={() => props.onDelete(play.id)}>
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
