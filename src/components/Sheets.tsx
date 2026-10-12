import { useEffect, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { formationBlurb, formationById, formationsFor, shapeFor } from '../formations'
import { applyFormation, presetOnPlayer, setOurSide, setShowDefense } from '../play'
import { applyPosition, positionSelected, positionsFor } from '../positions'
import { assignmentsFor, plainPreset, presetLabel } from '../presets'
import { categoriesFor, categoryOf } from '../categories'
import type { BreakSide } from '../play'
import type { Play, Player, PresetId } from '../types'
import { FORMATS, formatShort, formatStyle, ourSideOf, type FormatId } from '../types'
import { PathPreview } from './PathPreview'

export function Sheet(props: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ComponentChildren
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.onClose])

  return (
    <div class="scrim" onClick={props.onClose}>
      <div
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div class="grab" />
        <div class="sheet-head">
          <div class="sheet-titles">
            <h2>{props.title}</h2>
            {props.subtitle ? <p class="sheet-sub">{props.subtitle}</p> : null}
          </div>
          <button type="button" class="icon-btn" aria-label="Close" data-tip="Close this" onClick={props.onClose}>
            <CloseIcon />
          </button>
        </div>
        <div class="sheet-body">{props.children}</div>
      </div>
    </div>
  )
}

export function PlaySettings(props: { play: Play; onChange: (play: Play) => void; onClose: () => void }) {
  const { play } = props
  const [name, setName] = useState(play.name)
  const [formation, setFormation] = useState(play.formation)
  const [notes, setNotes] = useState(play.notes)
  const [pending, setPending] = useState<Play | null>(null)

  useEffect(() => {
    setName(play.name)
    setFormation(play.formation)
    setNotes(play.notes)
    setPending(null)
  }, [play.id])

  useEffect(() => {
    setName(play.name)
  }, [play.name])

  useEffect(() => {
    setFormation(play.formation)
  }, [play.formation])

  function edited(): Play {
    return {
      ...play,
      name: name.trim() || play.name,
      formation: formation.trim() || play.formation,
      notes,
    }
  }

  function request(next: Play) {
    const lineupChanged = ourSideOf(next) !== ourSideOf(play) || next.format !== play.format || next.formationId !== play.formationId
    if (lineupChanged && play.strokes.length > 0) setPending(next)
    else props.onChange(next)
  }

  return (
    <Sheet
      title="Setup"
      onClose={() => {
        props.onChange(edited())
        props.onClose()
      }}
    >
      <label class="field-label">
        Name
        <input value={name} maxLength={80} onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)} />
      </label>
      <label class="field-label">
        Lineup name
        <input
          value={formation}
          maxLength={40}
          onInput={(event) => setFormation((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <p class="field-label">Who has the ball?</p>
      <div class="chips">
        <button
          type="button"
          class="chip"
          aria-pressed={ourSideOf(play) === 'offense'}
          onClick={() => request(setOurSide(edited(), 'offense'))}
        >
          Us
        </button>
        <button
          type="button"
          class="chip"
          aria-pressed={ourSideOf(play) === 'defense'}
          onClick={() => request(setOurSide(edited(), 'defense'))}
        >
          Them
        </button>
      </div>
      <p class="fine">Orange is your team. Lime is the other team.</p>
      <p class="warn">Changing who has the ball or the lineup clears the lines. Tap Undo to bring them back.</p>
      <p class="field-label">How many</p>
      <div class="chips">
        {FORMATS.map((format) => (
          <button
            key={format.id}
            type="button"
            class="chip stack-chip"
            aria-pressed={play.format === format.id}
            onClick={() => {
              if (play.format === format.id) return
              request(applyFormation(edited(), format.id, play.formationId))
            }}
          >
            <span>{formatShort(format.id)}</span>
            <small>{formatStyle(format.id)}</small>
          </button>
        ))}
      </div>
      <p class="field-label">{ourSideOf(play) === 'defense' ? 'Their lineup' : 'Lineup'}</p>
      <LineupChoices
        format={play.format}
        selectedId={play.formationId}
        templates={formationsFor(play.format).filter((template) => !template.special)}
        onPick={(id) => {
          if (id === play.formationId) return
          request(applyFormation(edited(), play.format, id))
        }}
      />
      {play.format === '11v11' ? (
        <>
          <p class="field-label">Kicking</p>
          <LineupChoices
            format={play.format}
            selectedId={play.formationId}
            templates={formationsFor(play.format).filter((template) => template.special)}
            onPick={(id) => {
              if (id === play.formationId) return
              request(applyFormation(edited(), play.format, id))
            }}
          />
        </>
      ) : (
        <p class="fine">Flag does not use kicking.</p>
      )}
      <p class="field-label">Kind of play</p>
      <div class="cat-grid">
        {categoriesFor(play.format).map((category) => (
          <button
            key={category}
            type="button"
            class="choice"
            aria-pressed={categoryOf(play) === category}
            onClick={() => props.onChange({ ...edited(), category })}
          >
            {category}
          </button>
        ))}
      </div>
      <p class="field-label">Where the play starts</p>
      <div class="chips">
        {[5, 10, 15, 20, 25, 30, 40, 50].map((los) => (
          <button
            key={los}
            type="button"
            class="chip"
            aria-pressed={play.los === los}
            onClick={() => props.onChange({ ...edited(), los })}
          >
            {los === 50 ? '50' : los}
          </button>
        ))}
      </div>
      <label class="field-label">
        Note
        <textarea
          rows={4}
          maxLength={600}
          value={notes}
          onInput={(event) => setNotes((event.currentTarget as HTMLTextAreaElement).value)}
        />
      </label>
      {pending ? (
        <ConfirmDialog
          title="Clear the lines?"
          body="Changing who has the ball or the lineup clears the lines. Tap Undo later if you want them back."
          confirmLabel="Change it"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const next = pending
            setPending(null)
            if (next) props.onChange(next)
          }}
        />
      ) : null}
    </Sheet>
  )
}

function LineupChoices(props: {
  format: FormatId
  selectedId: string
  templates: { id: string; name: string }[]
  onPick: (id: string) => void
}) {
  return (
    <div class="lineup-grid">
      {props.templates.map((template) => (
        <button
          key={template.id}
          type="button"
          class="lineup-pick"
          aria-pressed={props.selectedId === template.id}
          onClick={() => props.onPick(template.id)}
        >
          <span>{template.name}</span>
          <small>{formationBlurb(props.format, template.id)}</small>
        </button>
      ))}
    </div>
  )
}

export function PresetSheet(props: {
  play: Play
  selectedId: string | null
  breakSide: BreakSide
  onSelect: (id: string) => void
  onBreakSide: (side: BreakSide) => void
  onApply: (playerId: string, preset: PresetId) => void
  onMan: (playerId: string, targetId: string) => void
  onRedraw: (playerId: string) => void
  onRemove: (playerId: string) => void
  onFlip: (playerId: string) => void
  onClose: () => void
}) {
  const visible = props.play.players.filter((player) => player.side === ourSideOf(props.play) || props.play.showDefense)
  const selected = visible.find((player) => player.id === props.selectedId) ?? null
  const [picked, setPicked] = useState<{ playerId: string; preset: PresetId } | null>(null)
  const fromPlay = selected ? presetOnPlayer(props.play, selected.id) : null
  const highlighted = selected && picked?.playerId === selected.id ? picked.preset : fromPlay
  const jobs = selected ? assignmentsFor(selected, Boolean(formationById(props.play.format, props.play.formationId).special), props.play.format) : []
  const targets = selected ? props.play.players.filter((player) => player.side !== selected.side && (player.side === ourSideOf(props.play) || props.play.showDefense)) : []
  const hasLine = selected ? props.play.strokes.some((stroke) => stroke.playerId === selected.id) : false
  return (
    <Sheet title="Paths" onClose={props.onClose}>
      <p class="field-label">Who</p>
      <div class="chips">
        {visible.map((player) => (
          <button
            key={player.id}
            type="button"
            class="chip player-chip"
            aria-pressed={player.id === selected?.id}
            onClick={() => props.onSelect(player.id)}
          >
            <i style={{ background: player.color }} />
            {player.label}
          </button>
        ))}
      </div>
      {selected ? (
        <>
          <p class="field-label">For {selected.label}</p>
          <div class="break-row" role="group" aria-label="Which way">
            <button type="button" class="choice" aria-pressed={props.breakSide === 'left'} onClick={() => props.onBreakSide('left')}>
              ← Left
            </button>
            <button type="button" class="choice" aria-pressed={props.breakSide === 'right'} onClick={() => props.onBreakSide('right')}>
              Right →
            </button>
          </div>
          {hasLine ? (
            <div class="route-options">
              {selected.side === 'defense' || props.play.format !== '11v11' ? null : (
                <button type="button" onClick={() => props.onApply(selected.id, 'block')}>
                  Block
                </button>
              )}
              <button type="button" onClick={() => props.onRedraw(selected.id)}>
                Redraw
              </button>
              <button type="button" onClick={() => props.onRemove(selected.id)}>
                Remove route
              </button>
              <button type="button" onClick={() => props.onFlip(selected.id)}>
                Flip
              </button>
            </div>
          ) : null}
          <div class="preset-grid">
            {jobs.map((preset) => (
              <button
                key={preset.id}
                type="button"
                class="preset"
                aria-pressed={preset.id === highlighted}
                onClick={() => {
                  setPicked({ playerId: selected.id, preset: preset.id })
                  if (preset.id !== 'man') props.onApply(selected.id, preset.id)
                }}
              >
                <PathPreview play={props.play} player={selected} preset={preset.id} side={props.breakSide} />
                <span>{preset.label}</span>
                <small>{plainPreset(preset.id)}</small>
              </button>
            ))}
          </div>
          {highlighted === 'man' ? (
            <>
              <p class="field-label">Cover who?</p>
              <div class="chips">
                {targets.map((player) => (
                  <button key={player.id} type="button" class="chip player-chip" onClick={() => props.onMan(selected.id, player.id)}>
                    <i style={{ background: player.color }} />
                    {player.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <p class="empty-copy">Tap a player first.</p>
      )}
    </Sheet>
  )
}

export function PlayerSheet(props: {
  play: Play
  player: Player
  onChange: (player: Player) => void
  onDeleteStroke: (id: string) => void
  onClose: () => void
}) {
  const { player } = props
  const [label, setLabel] = useState(player.label)
  const [note, setNote] = useState(player.note)
  useEffect(() => {
    setLabel(player.label)
    setNote(player.note)
  }, [player.id])

  function current(patch: Partial<Player> = {}): Player {
    const nextLabel = (patch.label ?? label).trim().slice(0, 4)
    return { ...player, ...patch, label: nextLabel || player.label, note: patch.note ?? note }
  }

  const strokes = props.play.strokes.filter((stroke) => stroke.playerId === player.id)

  return (
    <Sheet
      title={player.label}
      onClose={() => {
        props.onChange(current())
        props.onClose()
      }}
    >
      <label class="field-label">
        Name
        <input
          value={label}
          maxLength={4}
          onInput={(event) => setLabel((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <p class="field-label">Position</p>
      <div class="pos-grid">
        {positionsFor(props.play.format, player.side).map((option) => {
          const options = positionsFor(props.play.format, player.side)
          const pressed = positionSelected({ ...player, label }, option, options)
          return (
            <button
              key={option.id}
              type="button"
              class="pos"
              aria-pressed={pressed}
              aria-label={option.label}
              onClick={() => {
                const next = applyPosition(props.play, current(), option.id)
                setLabel(next.label)
                props.onChange(next)
              }}
            >
              <span class={`mark ${shapeFor(option.role)} ${player.side === ourSideOf(props.play) ? 'ours' : 'theirs'}`}>
                <span>{option.label}</span>
              </span>
            </button>
          )
        })}
      </div>
      <p class="field-label">Order</p>
      <p class="fine">1 goes first.</p>
      <div class="chips">
        <button type="button" class="chip" aria-pressed={player.read === null} onClick={() => props.onChange(current({ read: null }))}>
          Off
        </button>
        {[1, 2, 3, 4, 5].map((read) => (
          <button
            key={read}
            type="button"
            class="chip"
            aria-pressed={player.read === read}
            onClick={() => props.onChange(current({ read }))}
          >
            {read}
          </button>
        ))}
      </div>
      <label class="field-label">
        Note
        <textarea
          rows={3}
          maxLength={180}
          value={note}
          onInput={(event) => setNote((event.currentTarget as HTMLTextAreaElement).value)}
        />
      </label>
      <p class="field-label">Lines</p>
      {strokes.length === 0 ? <p class="empty-copy">No line yet. Tap Draw, then drag from this player. Or tap Paths.</p> : null}
      <div class="stack">
        {strokes.map((stroke) => (
          <button key={stroke.id} type="button" class="row-btn" onClick={() => props.onDeleteStroke(stroke.id)}>
            Remove {stroke.preset ? presetLabel(stroke.preset) : stroke.kind === 'motion' ? 'the walk' : stroke.kind === 'block' ? 'the block' : stroke.kind === 'run' ? 'the run' : 'route'}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

export function MoreSheet(props: {
  play: Play
  onChange: (play: Play) => void
  onDuplicate: () => void
  onExport: () => void
  onReset: () => void
  onFlip: () => void
  onShowTips: () => void
  onClose: () => void
}) {
  const [askReset, setAskReset] = useState(false)
  if (askReset) {
    return (
      <Sheet title="Reset?" onClose={() => setAskReset(false)}>
        <p class="fine">This puts the play back to how it started. You cannot undo it by staying on this screen. Your other plays stay.</p>
        <button type="button" class="primary wide choice" onClick={() => setAskReset(false)}>
          Cancel
        </button>
        <button
          type="button"
          class="primary wide choice danger"
          onClick={() => {
            setAskReset(false)
            props.onReset()
          }}
        >
          Reset
        </button>
      </Sheet>
    )
  }
  return (
    <Sheet title="More" onClose={props.onClose}>
      <button type="button" class="row-btn" onClick={() => props.onChange(setShowDefense(props.play, !props.play.showDefense))}>
        {props.play.showDefense ? 'Hide the other team' : 'Show the other team'}
        <small>{formatShort(props.play.format)}</small>
      </button>
      <button type="button" class="row-btn" onClick={() => setAskReset(true)}>
        Reset
        <small>Back to how it started</small>
      </button>
      <button type="button" class="row-btn" onClick={props.onFlip}>
        Flip play
        <small>Mirror everyone the other way</small>
      </button>
      <button type="button" class="row-btn" data-tip="See the short tour" onClick={props.onShowTips}>
        Show tips again
        <small>A short look around the screen</small>
      </button>
      <button type="button" class="row-btn" onClick={props.onExport}>
        Download pictures
        <small>A picture of this play to print or share</small>
      </button>
      <button type="button" class="row-btn" onClick={props.onDuplicate}>
        Copy this play
      </button>
      <p class="fine">A free account saves plays on every device. Plays already on this phone stay here.</p>
    </Sheet>
  )
}

export function ExportSheet(props: {
  busy: boolean
  includeNotes: boolean
  includeAssignments: boolean
  onToggleNotes: () => void
  onToggleAssignments: () => void
  onPng: (style: 'print' | 'color') => void
  onPdf: (style: 'print' | 'color') => void
  onClose: () => void
}) {
  return (
    <Sheet title="Save" onClose={props.onClose}>
      <div class="checks">
        <button type="button" class="chip" aria-pressed={props.includeNotes} onClick={props.onToggleNotes}>
          Notes
        </button>
        <button type="button" class="chip" aria-pressed={props.includeAssignments} onClick={props.onToggleAssignments}>
          Jobs
        </button>
      </div>
      <button type="button" class="primary wide" disabled={props.busy} onClick={() => props.onPng('print')}>
        Download white picture
      </button>
      <button type="button" class="primary wide ghost" disabled={props.busy} onClick={() => props.onPng('color')}>
        Download color picture
      </button>
      <button type="button" class="primary wide" disabled={props.busy} data-tip="White playbook with the dog" onClick={() => props.onPdf('print')}>
        Download white playbook
      </button>
      <button type="button" class="primary wide ghost" disabled={props.busy} data-tip="Color playbook with the dog" onClick={() => props.onPdf('color')}>
        Download color playbook
      </button>
      <p class="fine">Pictures and playbooks are letter size. The cover has the team dog. White is for printing. Color looks like the field. Play files are in Plays.</p>
    </Sheet>
  )
}

export function ConfirmDialog(props: {
  title: string
  body: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      props.onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [props.onCancel])

  return (
    <div class="scrim confirm-scrim" onClick={props.onCancel}>
      <div
        class="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{props.title}</h2>
        <p>{props.body}</p>
        <button ref={cancelRef} type="button" class="primary wide" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="button" class="primary wide danger" onClick={props.onConfirm}>
          {props.confirmLabel}
        </button>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  )
}

export type { FormatId }
