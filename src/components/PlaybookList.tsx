import { useState } from 'preact/hooks'
import type { Play } from '../types'
import { formatLabel } from '../types'

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
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <div class="book-list">
      <button type="button" class="primary wide" onClick={props.onCreate}>
        New play
      </button>
      {props.plays.length === 0 ? (
        <p class="empty-copy">No plays yet. Draw the first one under the lights.</p>
      ) : (
        <ul>
          {props.plays.map((play) => {
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
                      {play.formation} · {formatLabel(play.format)} · {age(play.updatedAt)}
                    </span>
                  </button>
                )}
                <div class="row-actions">
                  <button
                    type="button"
                    class="text-btn"
                    onClick={() => {
                      setRenaming(play.id)
                      setDraft(play.name)
                      setConfirmId(null)
                    }}
                  >
                    Rename
                  </button>
                  <button type="button" class="text-btn" onClick={() => props.onDuplicate(play.id)}>
                    Copy
                  </button>
                  {confirmId === play.id ? (
                    <button type="button" class="text-btn danger" onClick={() => props.onDelete(play.id)}>
                      Confirm
                    </button>
                  ) : (
                    <button type="button" class="text-btn danger" onClick={() => setConfirmId(play.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
