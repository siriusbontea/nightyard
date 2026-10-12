import { useEffect, useRef, useState } from 'preact/hooks'
import { PLAY_CATEGORIES, groupPlays, type PlayCategory } from '../categories'
import { filterDeskPlays, neighborId, readCollapsed, toggleCollapsed, visiblePlayIds, writeCollapsed } from '../deskList'
import type { Play } from '../types'
import { formatShort } from '../types'
import { PlayChoiceMenu } from './PlaybookSwitcher'

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
  books: { id: string; name: string }[]
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onCopyTo: (id: string, bookId: string) => void
  onMoveTo: (id: string, bookId: string) => void
  onCreateBook: () => void
  onCreate: () => void
  onImport?: () => void
  saveStatus?: string
  saveKind?: string
  onSaveStatus?: () => void
  example?: boolean
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState<PlayCategory | 'All'>('All')
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>(() => readCollapsed())
  const [menu, setMenu] = useState<{ id: string; top: number; left: number; mode: 'root' | 'copy' | 'move' } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const shown = filterDeskPlays(props.plays, query)
  const groups = groupPlays(shown, filter)
  const openIds = visiblePlayIds(groups, collapsed)

  useEffect(() => {
    if (!menu) return
    const close = (event: Event) => {
      const target = event.target
      if (target instanceof Node && menuRef.current?.contains(target)) return
      setMenu(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  function setOpen(id: string) {
    props.onOpen(id)
    const node = listRef.current?.querySelector<HTMLButtonElement>(`[data-play="${id}"]`)
    node?.focus()
    node?.scrollIntoView({ block: 'nearest' })
  }

  function onListKey(event: KeyboardEvent) {
    if (menu) return
    const target = event.target
    if (target instanceof HTMLElement && target.closest('input, textarea, select')) return
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const next = neighborId(openIds, props.currentId, event.key === 'ArrowDown' ? 1 : -1)
    if (next) setOpen(next)
  }

  function toggleSection(category: string) {
    const next = toggleCollapsed(collapsed, category)
    setCollapsed(next)
    writeCollapsed(next)
  }

  function openMenu(playId: string, button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect()
    const width = 248
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    const menuHeight = 280
    const top = rect.bottom + menuHeight > window.innerHeight ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4
    setMenu({ id: playId, top, left, mode: 'root' })
  }

  return (
    <div class="book-list">
      <div class="book-pin">
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
        <input
          class="desk-search"
          value={query}
          aria-label="Find a play"
          data-tip="Find a play"
          placeholder="Find a play"
          onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
        />
        <label class="field-label desk-show">
          Play type
          <select
            aria-label="Play type"
            value={filter}
            onChange={(event) => setFilter((event.currentTarget as HTMLSelectElement).value as PlayCategory | 'All')}
          >
            <option value="All">All plays</option>
            {PLAY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </div>
      {props.example ? (
        <p class="fine">Make a free account to save plays</p>
      ) : null}
      <div class="book-scroll" ref={listRef} tabIndex={0} aria-label={props.example ? 'Example plays' : 'Saved plays'} onKeyDown={onListKey}>
        {props.example ? <p class="backup-label">Example plays</p> : null}
        {props.plays.length === 0 ? (
          <p class="empty-copy">No plays yet. Tap New play.</p>
        ) : groups.length === 0 ? (
          <p class="empty-copy">No plays match.</p>
        ) : (
          groups.map((group) => {
            const shut = collapsed.includes(group.category)
            return (
              <section key={group.category}>
                <button
                  type="button"
                  class="section-toggle"
                  aria-expanded={!shut}
                  data-tip="Show or hide these"
                  onClick={() => toggleSection(group.category)}
                >
                  <span class="chev" aria-hidden="true">
                    {shut ? '▸' : '▾'}
                  </span>
                  <span>
                    {group.category} {group.plays.length}
                  </span>
                </button>
                {shut ? null : (
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
                            <button
                              type="button"
                              class="play-open"
                              data-play={play.id}
                              aria-current={current ? 'true' : undefined}
                              onClick={() => props.onOpen(play.id)}
                            >
                              <span class="play-name">{play.name}</span>
                              <span class="play-meta">
                                {formatShort(play.format)} · {age(play.updatedAt)}
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            class="row-more"
                            aria-label={`Choices for ${play.name}`}
                            data-tip="Play choices"
                            aria-expanded={menu?.id === play.id}
                            onClick={(event) => openMenu(play.id, event.currentTarget as HTMLButtonElement)}
                          >
                            ⋯
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })
        )}
      </div>
      {menu ? (
        <div class="row-menu wide" ref={menuRef} style={{ top: `${menu.top}px`, left: `${menu.left}px` }}>
          <PlayChoiceMenu
            mode={menu.mode}
            books={props.books.filter((book) => book.id !== props.plays.find((item) => item.id === menu.id)?.bookId)}
            onMode={(mode) => setMenu({ ...menu, mode })}
            onRename={() => {
              const play = props.plays.find((item) => item.id === menu.id)
              setMenu(null)
              if (!play) return
              setRenaming(play.id)
              setDraft(play.name)
            }}
            onDuplicate={() => {
              const id = menu.id
              setMenu(null)
              props.onDuplicate(id)
            }}
            onDelete={() => {
              const id = menu.id
              setMenu(null)
              props.onDelete(id)
            }}
            onPick={(bookId) => {
              const id = menu.id
              const mode = menu.mode
              setMenu(null)
              if (mode === 'move') props.onMoveTo(id, bookId)
              else props.onCopyTo(id, bookId)
            }}
            onCreateBook={() => {
              setMenu(null)
              props.onCreateBook()
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
