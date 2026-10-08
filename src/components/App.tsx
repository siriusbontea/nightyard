import { useEffect, useRef, useState } from 'preact/hooks'
import { cameraForBox } from '../geometry'
import { applyPreset, clearPlayerStrokes, deleteStroke, serializePlay, serializePlaybook, slug, updatePlayer } from '../play'
import { renderPng } from '../pngExport'
import { downloadBlob, downloadText } from '../download'
import { ballLabel } from '../play'
import { usePlaybook } from '../usePlaybook'
import type { FormatId, StrokeKind } from '../types'
import { formatShort } from '../types'
import { Field } from './Field'
import { PlaybookList } from './PlaybookList'
import { ExportSheet, MoreSheet, PlayerSheet, PlaySettings, PresetSheet, Sheet } from './Sheets'

type Tool = 'move' | 'draw'
type SheetId = null | 'book' | 'presets' | 'player' | 'more' | 'export' | 'play'
const SPEEDS = [0.5, 1, 1.5] as const
const SPEED_WORD: Record<(typeof SPEEDS)[number], string> = { 0.5: 'Slow', 1: 'Normal', 1.5: 'Fast' }
const DRAW_WORD: Record<StrokeKind, string> = { route: 'Line', motion: 'Walk', block: 'Block', run: 'Run' }

export function App() {
  const book = usePlaybook()
  const [tool, setTool] = useState<Tool>('move')
  const [strokeKind, setStrokeKind] = useState<StrokeKind>('route')
  const [sheet, setSheet] = useState<SheetId>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [includeAssignments, setIncludeAssignments] = useState(true)
  const [busy, setBusy] = useState(false)
  const [camera, setCamera] = useState(() => cameraForBox(360, 520))
  const frameRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const play = book.play

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setCamera(cameraForBox(rect.width, rect.height))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [play?.id, book.ready])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const duration = 3.2 / speed
      setT((current) => {
        const next = current + dt / duration
        if (next >= 1) {
          setPlaying(false)
          return 1
        }
        return next
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        setPlaying(false)
        if (event.shiftKey) book.redo()
        else book.undo()
      } else if (event.key === ' ' && play) {
        event.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function togglePlay() {
    if (playing) {
      setPlaying(false)
      return
    }
    if (t >= 0.999) setT(0)
    setPlaying(true)
  }

  function stopPlayback() {
    setPlaying(false)
    setT(0)
  }

  function startNew(format: FormatId) {
    void book.create(format).then(() => {
      setSelectedPlayerId(null)
      setSelectedStrokeId(null)
      stopPlayback()
      setSheet('play')
    })
  }

  async function exportPng(style: 'print' | 'color') {
    if (!play) return
    setBusy(true)
    try {
      const blob = await renderPng(play, style, { includeNotes, includeAssignments })
      downloadBlob(`${slug(play.name)}-${style}.png`, blob)
      book.notify(style === 'print' ? 'White picture saved' : 'Color picture saved')
    } catch (error) {
      book.notify(error instanceof Error ? error.message : 'Could not export the image.')
    } finally {
      setBusy(false)
    }
  }

  const selected = play?.players.find((player) => player.id === selectedPlayerId) ?? null

  if (!book.ready) {
    return (
      <div class="boot">
        <p class="brand">Night Yard</p>
        <p>Opening your plays…</p>
      </div>
    )
  }

  if (!play) {
    return (
      <div class="boot">
        <p class="brand">Night Yard</p>
        <h1>No plays yet</h1>
        <p class="empty-copy">Tap the button. Then pick how many players.</p>
        <button type="button" class="primary" onClick={() => startNew('5v5')}>
          New play
        </button>
        <button type="button" class="primary ghost" onClick={() => fileRef.current?.click()}>
          Open a file
        </button>
        <input
          ref={fileRef}
          class="file"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = (event.currentTarget as HTMLInputElement).files?.[0]
            if (!file) return
            file.text().then((text) => book.importJson(text)).catch(() => book.notify('Could not read that file.'))
            ;(event.currentTarget as HTMLInputElement).value = ''
          }}
        />
        {book.toast ? <Toast message={book.toast} undo={book.toastUndo} /> : null}
      </div>
    )
  }

  return (
    <div class="shell">
      <aside class="desk-book">
        <div class="desk-head">
          <p class="brand">Night Yard</p>
          <label class="field-label">
            Plays
            <input
              value={book.bookName}
              maxLength={60}
              onInput={(event) => book.renameBook((event.currentTarget as HTMLInputElement).value)}
            />
          </label>
        </div>
        <PlaybookList
          plays={book.plays}
          currentId={play.id}
          onOpen={(id) => {
            book.open(id)
            setSelectedPlayerId(null)
            setSelectedStrokeId(null)
            stopPlayback()
          }}
          onRename={book.rename}
          onDuplicate={book.duplicate}
          onDelete={book.remove}
          onCreate={() => startNew(play.format)}
        />
      </aside>
      <div class="stage">
        <header class="top">
          <div class="title-row">
            <button type="button" class="title-btn" onClick={() => setSheet('play')}>
              <span class="brand">Night Yard</span>
              <span class="play-title">{play.name}</span>
            </button>
            <button type="button" class="text-btn setup-btn" onClick={() => setSheet('play')}>
              Setup
            </button>
            <button type="button" class="icon-btn labeled" aria-label="Undo" disabled={!book.canUndo} onClick={book.undo}>
              <UndoIcon />
              <span>Undo</span>
            </button>
            <button type="button" class="icon-btn labeled" aria-label="Redo" disabled={!book.canRedo} onClick={book.redo}>
              <RedoIcon />
              <span>Redo</span>
            </button>
          </div>
          <p class="sub">
            {play.formation} · {formatShort(play.format)} · Start on {ballLabel(play.los)}
            {book.saved ? ' · Saved' : ''}
          </p>
        </header>
        <div class="field-wrap">
          <div class="field-frame">
            <div class="field-inner" ref={frameRef}>
              <Field
                play={play}
                camera={camera}
                tool={tool}
                strokeKind={strokeKind}
                selectedPlayerId={selectedPlayerId}
                selectedStrokeId={selectedStrokeId}
                playbackT={t}
                playing={playing}
                onCommit={(next) => {
                  stopPlayback()
                  book.update(next)
                }}
                onSelect={(playerId, strokeId) => {
                  setSelectedPlayerId(playerId)
                  setSelectedStrokeId(strokeId)
                }}
                onEditPlayer={(playerId) => {
                  setSelectedPlayerId(playerId)
                  setSheet('player')
                }}
                onStopPlayback={stopPlayback}
              />
            </div>
          </div>
        </div>
        <div class="playback" aria-label="Playback">
          <button type="button" class="icon-btn play" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <input
            class="scrub"
            type="range"
            min="0"
            max="1000"
            value={Math.round(t * 1000)}
            aria-label="Scrub the play"
            onInput={(event) => {
              setPlaying(false)
              setT(Number((event.currentTarget as HTMLInputElement).value) / 1000)
            }}
          />
          <button
            type="button"
            class="speed"
            aria-label={`Speed ${SPEED_WORD[speed]}`}
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          >
            {SPEED_WORD[speed]}
          </button>
        </div>
        {tool === 'draw' ? (
          <div class="coach">
            <p class="hint">Drag from a player.</p>
            <div class="kind-row">
              {(['route', 'motion', 'block', 'run'] as StrokeKind[]).map((kind) => (
                <button key={kind} type="button" class="chip" aria-pressed={strokeKind === kind} onClick={() => setStrokeKind(kind)}>
                  {DRAW_WORD[kind]}
                </button>
              ))}
            </div>
          </div>
        ) : selected ? (
          <div class="edit-row">
            <span class="who">
              <i style={{ background: selected.color }} />
              {selected.label}
            </span>
            <span class="hint grow">Drag {selected.label} to move.</span>
            <button type="button" class="text-btn" onClick={() => setSheet('player')}>
              Edit
            </button>
            <button
              type="button"
              class="text-btn"
              onClick={() => {
                book.update(clearPlayerStrokes(play, selected.id))
                setSelectedStrokeId(null)
                stopPlayback()
              }}
            >
              Erase
            </button>
          </div>
        ) : (
          <p class="hint">{play.strokes.length === 0 ? 'Tap Draw, then drag from a player.' : 'Tap Play to watch.'}</p>
        )}
        <nav class="toolbar" aria-label="Tools">
          <button type="button" class="tool" onClick={() => setSheet('book')}>
            <BookIcon />
            Plays
          </button>
          <button type="button" class="tool" aria-pressed={tool === 'move'} onClick={() => setTool('move')}>
            <MoveIcon />
            Move
          </button>
          <button type="button" class="tool" aria-pressed={tool === 'draw'} onClick={() => setTool('draw')}>
            <DrawIcon />
            Draw
          </button>
          <button type="button" class="tool" onClick={() => setSheet('presets')}>
            <RouteIcon />
            Paths
          </button>
          <button type="button" class="tool" onClick={() => setSheet('more')}>
            <MoreIcon />
            More
          </button>
        </nav>
      </div>
      {sheet === 'book' ? (
        <Sheet title={book.bookName} onClose={() => setSheet(null)}>
          <PlaybookList
            plays={book.plays}
            currentId={play.id}
            onOpen={(id) => {
              book.open(id)
              setSelectedPlayerId(null)
              setSelectedStrokeId(null)
              stopPlayback()
              setSheet(null)
            }}
            onRename={book.rename}
            onDuplicate={(id) => {
              book.duplicate(id)
              setSheet(null)
            }}
            onDelete={book.remove}
            onCreate={() => startNew(play.format)}
          />
        </Sheet>
      ) : null}
      {sheet === 'play' ? (
        <PlaySettings
          play={play}
          onChange={(next) => {
            stopPlayback()
            if (next.format !== play.format || next.formationId !== play.formationId) {
              setSelectedPlayerId(null)
              setSelectedStrokeId(null)
            }
            book.update(next)
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'presets' ? (
        <PresetSheet
          play={play}
          selectedId={selectedPlayerId}
          onSelect={(id) => {
            setSelectedPlayerId(id)
            const stroke = play.strokes.find((item) => item.playerId === id && item.kind !== 'motion') ?? play.strokes.find((item) => item.playerId === id)
            setSelectedStrokeId(stroke?.id ?? null)
          }}
          onApply={(playerId, preset) => {
            stopPlayback()
            const next = applyPreset(play, playerId, preset)
            const stroke = next.strokes.find((item) => item.playerId === playerId && item.preset === preset)
            setSelectedPlayerId(playerId)
            setSelectedStrokeId(stroke?.id ?? null)
            book.update(next)
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'player' && selected ? (
        <PlayerSheet
          play={play}
          player={selected}
          onChange={(player) => book.update(updatePlayer(play, player.id, player))}
          onDeleteStroke={(id) => {
            book.update(deleteStroke(play, id))
            if (selectedStrokeId === id) setSelectedStrokeId(null)
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'more' ? (
        <MoreSheet
          play={play}
          onChange={(next) => book.update(next)}
          onDuplicate={() => {
            book.duplicate(play.id)
            setSheet(null)
          }}
          onDelete={() => {
            book.remove(play.id)
            setSheet(null)
            setSelectedPlayerId(null)
          }}
          onExport={() => setSheet('export')}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'export' ? (
        <ExportSheet
          busy={busy}
          includeNotes={includeNotes}
          includeAssignments={includeAssignments}
          onToggleNotes={() => setIncludeNotes((value) => !value)}
          onToggleAssignments={() => setIncludeAssignments((value) => !value)}
          onPng={exportPng}
          onJsonPlay={() => {
            downloadText(`${slug(play.name)}.json`, serializePlay(play))
            book.notify('Play file saved')
          }}
          onJsonBook={() => {
            downloadText(`${slug(book.bookName)}.json`, serializePlaybook(book.bookName, book.plays))
            book.notify('All plays saved')
          }}
          onImport={() => fileRef.current?.click()}
          onClose={() => setSheet(null)}
        />
      ) : null}
      <input
        ref={fileRef}
        class="file"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = (event.currentTarget as HTMLInputElement).files?.[0]
          if (!file) return
          file
            .text()
            .then((text) => book.importJson(text))
            .catch((error) => book.notify(error instanceof Error ? error.message : 'Could not import that file.'))
          ;(event.currentTarget as HTMLInputElement).value = ''
        }}
      />
      {book.toast ? <Toast message={book.toast} undo={book.toastUndo} /> : null}
    </div>
  )
}

function Toast(props: { message: string; undo: (() => void) | null }) {
  return (
    <div class="toast" role="status">
      <span>{props.message}</span>
      {props.undo ? (
        <button type="button" class="toast-undo" onClick={props.undo}>
          Undo
        </button>
      ) : null}
    </div>
  )
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M8 8H4v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M4 12a8 8 0 1 0 2.2-5.5L4 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  )
}
function RedoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M16 8h4v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M20 12a8 8 0 1 1-2.2-5.5L20 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  )
}
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M8 6l12 6-12 6V6z" fill="currentColor" />
    </svg>
  )
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
    </svg>
  )
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M5 4.5h9.5A3.5 3.5 0 0 1 18 8v11.5H8.2A3.2 3.2 0 0 0 5 16.3V4.5z" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path d="M5 16.2h13" stroke="currentColor" stroke-width="1.8" />
    </svg>
  )
}
function MoveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  )
}
function DrawIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 16c4-1 6-8 8-8s3 5 8 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <path d="M17 7l3 1-1 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    </svg>
  )
}
function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M6 18V8l6 4 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M14 6h4v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  )
}
function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}
