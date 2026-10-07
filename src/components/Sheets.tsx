import { useEffect, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { formationsFor } from '../formations'
import { applyFormation, setShowDefense } from '../play'
import { ROUTE_PRESETS, kindLabel, presetLabel } from '../presets'
import type { Play, Player } from '../types'
import { FORMATS, formatLabel, type FormatId } from '../types'

export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren }) {
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
          <h2>{props.title}</h2>
          <button type="button" class="icon-btn" aria-label="Close" onClick={props.onClose}>
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

  useEffect(() => {
    setName(play.name)
    setFormation(play.formation)
    setNotes(play.notes)
  }, [play.id])

  function edited(): Play {
    return {
      ...play,
      name: name.trim() || play.name,
      formation: formation.trim() || play.formation,
      notes,
    }
  }

  return (
    <Sheet
      title="Play"
      onClose={() => {
        props.onChange(edited())
        props.onClose()
      }}
    >
      <label class="field-label">
        Play name
        <input value={name} maxLength={80} onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)} />
      </label>
      <label class="field-label">
        Formation name
        <input
          value={formation}
          maxLength={40}
          onInput={(event) => setFormation((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <p class="field-label">Format</p>
      <div class="chips">
        {FORMATS.map((format) => (
          <button
            key={format.id}
            type="button"
            class="chip"
            aria-pressed={play.format === format.id}
            onClick={() => props.onChange(applyFormation(edited(), format.id, play.formationId))}
          >
            {format.label}
          </button>
        ))}
      </div>
      <p class="field-label">Personnel</p>
      <div class="chips">
        {formationsFor(play.format).map((template) => (
          <button
            key={template.id}
            type="button"
            class="chip"
            aria-pressed={play.formationId === template.id}
            onClick={() => props.onChange(applyFormation(edited(), play.format, template.id))}
          >
            {template.name}
          </button>
        ))}
      </div>
      <p class="field-label">Ball on</p>
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
        Notes
        <textarea
          rows={4}
          maxLength={600}
          value={notes}
          onInput={(event) => setNotes((event.currentTarget as HTMLTextAreaElement).value)}
        />
      </label>
      <p class="fine">Switching format or personnel clears routes. Undo puts them back.</p>
    </Sheet>
  )
}

export function PresetSheet(props: {
  play: Play
  selectedId: string | null
  onSelect: (id: string) => void
  onApply: (playerId: string, preset: (typeof ROUTE_PRESETS)[number]['id']) => void
  onClose: () => void
}) {
  const visible = props.play.players.filter((player) => player.side === 'offense' || props.play.showDefense)
  const selected = visible.find((player) => player.id === props.selectedId) ?? null
  return (
    <Sheet title="Routes" onClose={props.onClose}>
      <p class="field-label">Player</p>
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
          <p class="field-label">Assign to {selected.label}</p>
          <div class="preset-grid">
            {ROUTE_PRESETS.map((preset) => (
              <button key={preset.id} type="button" class="preset" onClick={() => props.onApply(selected.id, preset.id)}>
                <span>{preset.label}</span>
                <small>{kindLabel(preset.kind)}</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p class="empty-copy">Choose who is running it, then tap a route.</p>
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
        Label
        <input
          value={label}
          maxLength={4}
          onInput={(event) => setLabel((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <p class="field-label">QB read</p>
      <div class="chips">
        <button type="button" class="chip" aria-pressed={player.read === null} onClick={() => props.onChange(current({ read: null }))}>
          None
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
        Assignment note
        <textarea
          rows={3}
          maxLength={180}
          value={note}
          onInput={(event) => setNote((event.currentTarget as HTMLTextAreaElement).value)}
        />
      </label>
      <p class="field-label">Paths</p>
      {strokes.length === 0 ? <p class="empty-copy">No route yet. Drag from this player, or pick one from Routes.</p> : null}
      <div class="stack">
        {strokes.map((stroke) => (
          <button key={stroke.id} type="button" class="row-btn" onClick={() => props.onDeleteStroke(stroke.id)}>
            Remove {stroke.preset ? presetLabel(stroke.preset) : kindLabel(stroke.kind)}
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
  onDelete: () => void
  onExport: () => void
  onClose: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    <Sheet title="More" onClose={props.onClose}>
      <button type="button" class="row-btn" onClick={() => props.onChange(setShowDefense(props.play, !props.play.showDefense))}>
        {props.play.showDefense ? 'Hide defense' : 'Show defense'}
        <small>{formatLabel(props.play.format)} shell</small>
      </button>
      <button type="button" class="row-btn" onClick={props.onExport}>
        Export and import
        <small>PNG sheets or a JSON file</small>
      </button>
      <button type="button" class="row-btn" onClick={props.onDuplicate}>
        Duplicate this play
      </button>
      {confirm ? (
        <button type="button" class="row-btn danger" onClick={props.onDelete}>
          Delete {props.play.name} for good
        </button>
      ) : (
        <button type="button" class="row-btn danger" onClick={() => setConfirm(true)}>
          Delete this play
        </button>
      )}
      <p class="fine">Night Yard is a play designer for Sirius Bontea. Flag from 5v5 to 9v9, plus 11v11 tackle. Plays stay on this device until you export them.</p>
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
  onJsonPlay: () => void
  onJsonBook: () => void
  onImport: () => void
  onClose: () => void
}) {
  return (
    <Sheet title="Export" onClose={props.onClose}>
      <div class="checks">
        <button type="button" class="chip" aria-pressed={props.includeNotes} onClick={props.onToggleNotes}>
          Notes
        </button>
        <button type="button" class="chip" aria-pressed={props.includeAssignments} onClick={props.onToggleAssignments}>
          Assignments
        </button>
      </div>
      <button type="button" class="primary wide" disabled={props.busy} onClick={() => props.onPng('print')}>
        Print white PNG
      </button>
      <button type="button" class="primary wide ghost" disabled={props.busy} onClick={() => props.onPng('color')}>
        Color field PNG
      </button>
      <p class="fine">Letter size, 150 dpi. Print white is black line art on white. Color field is green turf with the same icons.</p>
      <button type="button" class="row-btn" onClick={props.onJsonPlay}>
        Download this play (JSON)
      </button>
      <button type="button" class="row-btn" onClick={props.onJsonBook}>
        Download playbook (JSON)
      </button>
      <button type="button" class="row-btn" onClick={props.onImport}>
        Import JSON
      </button>
    </Sheet>
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
