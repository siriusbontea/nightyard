import { useEffect, useRef, useState } from 'preact/hooks'
import { deleteBookLabel } from '../playbooks'
import type { Playbook } from '../types'

export function PlaybookSwitcher(props: {
  books: Playbook[]
  currentId: string
  countIn: (id: string) => number
  onSwitch: (id: string) => void
  onCreate: () => void
  onRename: (id: string, name: string) => void
  onCopy: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const current = props.books.find((book) => book.id === props.currentId) ?? props.books[0]
  const last = props.books.length <= 1

  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      const target = event.target
      if (target instanceof Node && wrapRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  if (!current) return null

  return (
    <div class="book-switch-wrap" ref={wrapRef}>
      <button
        type="button"
        class="book-switch"
        aria-expanded={open}
        aria-label={`Playbook ${current.name}`}
        data-tip="Switch playbook"
        onClick={() => setOpen((value) => !value)}
      >
        <span class="book-switch-name">{current.name}</span>
        <span class="book-switch-chev" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <div class="book-switch-panel" role="listbox" aria-label="Playbooks">
          {props.books.map((book) => {
            const selected = book.id === current.id
            return (
              <div key={book.id} class={selected ? 'book-switch-row current' : 'book-switch-row'}>
                {renaming === book.id ? (
                  <form
                    class="rename-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      props.onRename(book.id, draft)
                      setRenaming(null)
                    }}
                  >
                    <input
                      aria-label={`Rename ${book.name}`}
                      value={draft}
                      maxLength={60}
                      onInput={(event) => setDraft((event.currentTarget as HTMLInputElement).value)}
                    />
                    <button type="submit" class="text-btn">
                      Save
                    </button>
                  </form>
                ) : (
                  <button type="button" class="book-pick" aria-current={selected ? 'true' : undefined} onClick={() => { props.onSwitch(book.id); setOpen(false) }}>
                    {book.name}
                  </button>
                )}
                <button
                  type="button"
                  class="text-btn"
                  data-tip="Rename this playbook"
                  aria-label={`Rename ${book.name}`}
                  onClick={() => {
                    setRenaming(book.id)
                    setDraft(book.name)
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  class="text-btn"
                  data-tip="Copy this playbook"
                  aria-label={`Copy ${book.name}`}
                  onClick={() => {
                    setOpen(false)
                    props.onCopy(book.id)
                  }}
                >
                  Copy
                </button>
                {last ? null : (
                  <button
                    type="button"
                    class="text-btn danger"
                    data-tip="Delete this playbook"
                    aria-label={`Delete ${book.name}`}
                    onClick={() => {
                      if (!window.confirm(deleteBookLabel(book.name, props.countIn(book.id)))) return
                      setOpen(false)
                      props.onDelete(book.id)
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )
          })}
          <button
            type="button"
            class="primary wide"
            data-tip="Make a new playbook"
            aria-label="New playbook"
            onClick={() => {
              setOpen(false)
              props.onCreate()
            }}
          >
            New playbook
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function PlayChoiceMenu(props: {
  mode: 'root' | 'copy' | 'move'
  books: { id: string; name: string }[]
  onMode: (mode: 'root' | 'copy' | 'move') => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  onPick: (bookId: string) => void
  onCreateBook: () => void
}) {
  if (props.mode !== 'root') {
    const title = props.mode === 'copy' ? 'Copy to' : 'Move to'
    return (
      <>
        <p class="menu-label">{title}</p>
        {props.books.map((book) => (
          <button key={book.id} type="button" onClick={() => props.onPick(book.id)}>
            {book.name}
          </button>
        ))}
        <button type="button" data-tip="Make a new playbook" onClick={props.onCreateBook}>
          Make a new playbook
        </button>
        <button type="button" onClick={() => props.onMode('root')}>
          Back
        </button>
      </>
    )
  }
  return (
    <>
      <button type="button" onClick={props.onRename}>
        Rename
      </button>
      <button type="button" onClick={props.onDuplicate}>
        Copy
      </button>
      <button type="button" aria-label="Copy to another playbook" onClick={() => props.onMode('copy')}>
        Copy to another playbook
      </button>
      <button type="button" aria-label="Move to another playbook" onClick={() => props.onMode('move')}>
        Move to another playbook
      </button>
      <button type="button" class="danger" onClick={props.onDelete}>
        Delete
      </button>
    </>
  )
}
