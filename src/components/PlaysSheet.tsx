import { useEffect, useRef, useState } from 'preact/hooks'
import { PLAY_CATEGORIES, categoriesFor, categoryOf, groupPlays, type PlayCategory } from '../categories'
import { filterSavedPlays, playThumb, showsSavedSearch } from '../savedPlays'
import type { Play, Playbook } from '../types'
import { formatShort } from '../types'
import { tip } from '../hints'
import { PlayChoiceMenu, PlaybookSwitcher } from './PlaybookSwitcher'
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
  books: Playbook[]
  currentBookId: string
  onlyBook: boolean
  countIn: (id: string) => number
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
  onCopyTo: (id: string, bookId: string) => void
  onMoveTo: (id: string, bookId: string) => void
  onSwitchBook: (id: string) => void
  onCreateBook: () => void
  onRenameBook: (id: string, name: string) => void
  onCopyBook: (id: string) => void
  onDeleteBook: (id: string) => void
  onCategory: (category: PlayCategory) => void
  onDownloadPlay: () => void
  onDownloadAll: () => void
  onLoadFile: () => void
  onSignIn: () => void
  onPlaybook: () => void
  onNeedAccount: () => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState<PlayCategory | 'All'>('All')
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(props.current.name)
  const [dest, setDest] = useState<'copy' | 'move' | null>(null)
  const [menu, setMenu] = useState<{ id: string; top: number; left: number; mode: 'root' | 'copy' | 'move' } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(props.current.name)
    setRenaming(false)
    setDest(null)
  }, [props.current.id])

  useEffect(() => {
    if (!menu) return
    const close = (event: Event) => {
      const target = event.target
      if (target instanceof Node && menuRef.current?.contains(target)) return
      setMenu(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menu])

  const offline = props.signedIn && typeof navigator !== 'undefined' && navigator.onLine === false
  const source = props.plays
  const shown = filterSavedPlays(source, query)
  const otherBooks = props.books.filter((book) => book.id !== props.currentBookId)
  const groups = groupPlays(shown, filter)
  const search = showsSavedSearch(source.length)

  return (
    <Sheet title="Plays" subtitle={props.signedIn ? 'Saved to your account' : undefined} onClose={props.onClose}>
      <PlaybookSwitcher
        books={props.books}
        currentId={props.currentBookId}
        countIn={props.countIn}
        onSwitch={props.onSwitchBook}
        onCreate={props.onCreateBook}
        onRename={props.onRenameBook}
        onCopy={props.onCopyBook}
        onDelete={props.onDeleteBook}
      />
      <button type="button" class="primary wide" onClick={props.onCreate}>
        New play
      </button>
      <button
        type="button"
        class="primary wide ghost"
        {...tip(props.signedIn ? 'Pick plays for a PDF' : 'Make a free account')}
        onClick={props.signedIn ? props.onPlaybook : props.onNeedAccount}
      >
        Make a playbook
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
        {dest ? (
          <div class="dest-list">
            <p class="field-label">{dest === 'copy' ? 'Copy to' : 'Move to'}</p>
            {otherBooks.map((book) => (
              <button
                key={book.id}
                type="button"
                class="text-btn"
                onClick={() => {
                  if (dest === 'move') props.onMoveTo(props.current.id, book.id)
                  else props.onCopyTo(props.current.id, book.id)
                  setDest(null)
                }}
              >
                {book.name}
              </button>
            ))}
            <button type="button" class="text-btn" onClick={props.onCreateBook}>
              New playbook
            </button>
            <button type="button" class="text-btn" onClick={() => setDest(null)}>
              Back
            </button>
          </div>
        ) : (
          <div class="row-actions wrap">
            <button type="button" class="text-btn" data-tip="Copy to another playbook" onClick={() => setDest('copy')}>
              Copy to another playbook
            </button>
            <button type="button" class="text-btn" data-tip="Move to another playbook" onClick={() => setDest('move')}>
              Move to another playbook
            </button>
          </div>
        )}
        <p class="field-label">Category</p>
        <div class="chips">
          {categoriesFor(props.current.format).map((category) => (
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
                <div key={play.id} class="saved-row">
                  <button type="button" class="saved-open" onClick={() => props.onOpen(play)}>
                    <span class="saved-thumb" dangerouslySetInnerHTML={{ __html: playThumb(play) }} />
                    <span class="saved-copy">
                      <span class="play-name">{play.name}</span>
                      <span class="play-meta">
                        {formatShort(play.format)} · {age(play.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="row-more"
                    aria-label={`Choices for ${play.name}`}
                    data-tip="Play choices"
                    aria-expanded={menu?.id === play.id}
                    onClick={(event) => {
                      const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect()
                      const width = 248
                      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
                      const top = rect.bottom + 4
                      setMenu({ id: play.id, top, left, mode: 'root' })
                    }}
                  >
                    ⋯
                  </button>
                </div>
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
        <button type="button" class="primary wide ghost" data-tip="Download this playbook" onClick={props.onDownloadAll}>
          Download this playbook (file)
        </button>
        <button type="button" class="primary wide ghost" data-tip="Load a playbook file" onClick={props.onLoadFile}>
          Load a playbook from a file
        </button>
        <p class="fine">Your plays already save to your account. These make a file on this phone.</p>
      </section>
      {menu ? (
        <div class="row-menu wide" ref={menuRef} style={{ top: `${menu.top}px`, left: `${menu.left}px` }}>
          <PlayChoiceMenu
            mode={menu.mode}
            books={otherBooks}
            onMode={(mode) => setMenu({ ...menu, mode })}
            onRename={() => {
              const play = source.find((item) => item.id === menu.id)
              setMenu(null)
              if (!play) return
              const name = window.prompt('Rename this play', play.name)
              if (name && name.trim()) props.onRename(play.id, name)
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
    </Sheet>
  )
}
