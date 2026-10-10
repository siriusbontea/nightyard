import { useEffect, useRef, useState } from 'preact/hooks'
import { categoryOf, groupPlays } from '../categories'
import { fetchServerPlays, playThumb } from '../savedPlays'
import {
  categoryAllOn,
  numberedPlays,
  pickCountLabel,
  playbookTitle,
  setCategory,
  toggleId,
  DEFAULT_PLAYBOOK_TITLE,
} from '../playbookLayout'
import type { ExportStyle } from '../exportSvg'
import type { Play } from '../types'
import { formatShort } from '../types'
import { Sheet } from './Sheets'

export function PlaybookSheet(props: {
  localPlays: Play[]
  busy: boolean
  onClose: () => void
  onMake: (choice: { title: string; style: ExportStyle; plays: Play[] }) => void
}) {
  const [plays, setPlays] = useState<Play[] | null>(null)
  const [offline, setOffline] = useState(false)
  const [title, setTitle] = useState(DEFAULT_PLAYBOOK_TITLE)
  const [style, setStyle] = useState<ExportStyle>('color')
  const [picked, setPicked] = useState<string[]>([])
  const localPlays = useRef(props.localPlays)
  localPlays.current = props.localPlays

  useEffect(() => {
    let cancel = false
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPlays(localPlays.current)
      setOffline(true)
      return
    }
    fetchServerPlays()
      .then((next) => {
        if (!cancel) setPlays(next)
      })
      .catch(() => {
        if (!cancel) {
          setPlays(localPlays.current)
          setOffline(true)
        }
      })
    return () => {
      cancel = true
    }
  }, [])

  const list = plays ?? []
  const listKey = list.map((play) => play.id).join('\n')
  useEffect(() => {
    setPicked(listKey ? listKey.split('\n') : [])
  }, [listKey])

  const entries = list.map((play) => ({ id: play.id, name: play.name, category: categoryOf(play) }))
  const ordered = numberedPlays(entries, picked)
  const groups = groupPlays(entries, 'All')
  const byId = new Map(list.map((play) => [play.id, play]))

  function make() {
    const chosen = ordered.flatMap((item) => {
      const play = byId.get(item.id)
      return play ? [play] : []
    })
    props.onMake({ title: playbookTitle(title), style, plays: chosen })
  }

  return (
    <Sheet title="Make a playbook" onClose={props.onClose}>
      <label class="field-label">
        Playbook name
        <input
          value={title}
          maxLength={80}
          aria-label="Playbook name"
          data-tip="Playbook name"
          onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <div class="style-picks">
        <button
          type="button"
          class="chip"
          aria-pressed={style === 'color'}
          data-tip="Color pages"
          aria-label="Color playbook"
          onClick={() => setStyle('color')}
        >
          Color
        </button>
        <button
          type="button"
          class="chip"
          aria-pressed={style === 'print'}
          data-tip="White pages for printing"
          aria-label="White playbook"
          onClick={() => setStyle('print')}
        >
          White (print)
        </button>
      </div>
      <p class="pick-count">{plays === null ? 'Loading your plays…' : pickCountLabel(ordered.length)}</p>
      <p class="fine">Cover, a quick view, then one page for each play.</p>
      {offline ? <p class="fine">Offline — showing plays on this phone.</p> : null}
      <div class="pick-scroll">
        {plays !== null && groups.length === 0 ? <p class="empty-copy">No saved plays yet.</p> : null}
        {groups.map((group) => {
          const ids = group.plays.map((play) => play.id)
          const all = categoryAllOn(picked, ids)
          return (
            <section key={group.category}>
              <div class="pick-head">
                <p class="group-label">{group.category}</p>
                <button
                  type="button"
                  class="select-all"
                  aria-pressed={all}
                  data-tip="Pick every play here"
                  aria-label={`Select all ${group.category}`}
                  onClick={() => setPicked(setCategory(picked, ids, !all))}
                >
                  <span class="pick-box" aria-hidden="true">
                    {all ? <CheckIcon /> : null}
                  </span>
                  Select all
                </button>
              </div>
              <div class="saved-list">
                {group.plays.map((item) => {
                  const play = byId.get(item.id)
                  if (!play) return null
                  const on = picked.includes(play.id)
                  const tip = on ? 'Take this play off' : 'Add this play'
                  return (
                    <button
                      key={play.id}
                      type="button"
                      class="pick-row"
                      aria-pressed={on}
                      data-tip={tip}
                      aria-label={`${play.name}. ${tip}`}
                      onClick={() => setPicked(toggleId(picked, play.id))}
                    >
                      <span class="pick-box" aria-hidden="true">
                        {on ? <CheckIcon /> : null}
                      </span>
                      <span class="saved-thumb" dangerouslySetInnerHTML={{ __html: playThumb(play) }} />
                      <span class="saved-copy">
                        <span class="play-name">{play.name}</span>
                        <span class="play-meta">{formatShort(play.format)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      <button
        type="button"
        class="primary wide"
        data-tip="Save the playbook"
        disabled={props.busy || plays === null || ordered.length === 0}
        onClick={make}
      >
        {props.busy ? 'Making the PDF…' : 'Make PDF'}
      </button>
    </Sheet>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M5 12.5 9.2 17 19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}
