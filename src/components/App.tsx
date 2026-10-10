import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { DEFAULT_LOS } from '../fieldMarks'
import { cameraForBox } from '../geometry'
import {
  applyMan,
  applyPreset,
  ballLabel,
  ballXOf,
  clearPlayerStrokes,
  defaultBreakSide,
  deleteStroke,
  flipPlay,
  mainStroke,
  mirrorPlayerRoutes,
  removeRoute,
  routeBreakSide,
  serializePlay,
  serializePlaybookFile,
  slug,
  updatePlayer,
  type BreakSide,
} from '../play'
import { isDefensePreset, isDirectionalPreset } from '../presets'
import { renderPng } from '../pngExport'
import { renderPlaybookFile, renderPlaybookPdf } from '../playbookPdf'
import { playbookTitle } from '../playbookLayout'
import { fieldHint, clearTipsSeen, markTipsSeen, tip, tipsSeen } from '../hints'
import { downloadBlob, downloadText, shareOrDownload } from '../download'
import { usePlaybook } from '../usePlaybook'
import type { PlayCategory } from '../categories'
import type { Play, PresetId, StrokeKind } from '../types'
import { formatShort } from '../types'
import { Field } from './Field'
import { PlaybookList } from './PlaybookList'
import { PlaybookSwitcher } from './PlaybookSwitcher'
import { PlaysSheet } from './PlaysSheet'
import { PlaybookSheet } from './PlaybookSheet'
import { dismissWelcome, saveNeedsAccount, shouldShowWelcome, welcomeDismissed } from '../guest'
import { AccountSheet } from './AccountSheet'
import { ExportSheet, MoreSheet, PlayerSheet, PlaySettings, PresetSheet } from './Sheets'
import { SavedPlaysSheet } from './SavedPlaysSheet'
import { GuestSavePrompt, WelcomeCard } from './WelcomeCard'
import { TipHost } from './TipHost'
import { CoachTour } from './CoachTour'

type Tool = 'move' | 'draw'
type SheetId = null | 'book' | 'presets' | 'player' | 'more' | 'export' | 'play' | 'account' | 'playbook'
const SPEEDS = [0.5, 1, 1.5] as const
const SPEED_WORD: Record<(typeof SPEEDS)[number], string> = { 0.5: 'Slow', 1: 'Normal', 1.5: 'Fast' }
const DRAW_WORD: Record<StrokeKind, string> = { route: 'Line', motion: 'Walk', block: 'Block', run: 'Run' }
const DRAW_TIP: Record<StrokeKind, string> = {
  route: 'Draw a route',
  motion: 'Move before the snap',
  block: 'Draw a block',
  run: 'Draw a run',
}
const SAVE_EXPLAINER = 'Your plays save by themselves. Open them on any device by signing in.'

function SaveChip(props: {
  label: string
  kind: string
  onGuest: () => void
  onExplain: () => void
}) {
  if (!props.label) return null
  if (props.kind === 'guest') {
    return (
      <button type="button" class="save-chip guest" data-tip="Make a free account" onClick={props.onGuest}>
        {props.label}
      </button>
    )
  }
  if (props.kind === 'local') return <p class="save-chip static">{props.label}</p>
  return (
    <button type="button" class={`save-chip ${props.kind}`} data-tip="Shows if the play is saved" aria-live="polite" onClick={props.onExplain}>
      {props.label}
    </button>
  )
}

/** Guess the field frame before it is measured so the first paint is already full. */
function openingCamera(los = DEFAULT_LOS) {
  if (typeof window === 'undefined') return cameraForBox(390, 680, los)
  const width = Math.max(40, Math.min(window.innerWidth, 560) - 20)
  const height = Math.max(280, window.innerHeight - 210)
  return cameraForBox(width, height, los)
}

export function App() {
  const book = usePlaybook()
  const [tool, setTool] = useState<Tool>('move')
  const [redrawPlayerId, setRedrawPlayerId] = useState<string | null>(null)
  const [breakSide, setBreakSide] = useState<BreakSide>('right')
  const [breakFor, setBreakFor] = useState<string | null>(null)
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
  const [camera, setCamera] = useState(() => openingCamera(DEFAULT_LOS))
  const [accountMode, setAccountMode] = useState<'in' | 'up'>('in')
  const [savePrompt, setSavePrompt] = useState(false)
  const [promptDetail, setPromptDetail] = useState<string | null>(null)
  const [welcomeOn, setWelcomeOn] = useState(() => shouldShowWelcome(false, welcomeDismissed()))
  const [tourOn, setTourOn] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const play = book.play

  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 40 || rect.height < 40) return
      setCamera(cameraForBox(rect.width, rect.height, play?.los ?? DEFAULT_LOS))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [play?.id, play?.los, book.ready])

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

  function openAccount(mode: 'in' | 'up') {
    setAccountMode(mode)
    setSavePrompt(false)
    setSheet('account')
  }

  function tryFirst() {
    dismissWelcome()
    setWelcomeOn(false)
  }

  useEffect(() => {
    if (!book.accountName) return
    dismissWelcome()
    setWelcomeOn(false)
  }, [book.accountName])

  useEffect(() => {
    if (!play || tipsSeen() || welcomeOn) return
    setTourOn(true)
  }, [play?.id, welcomeOn])

  function chooseTool(next: Tool) {
    setTool(next)
    setRedrawPlayerId(null)
  }

  function guestBlocked(action: 'save-play' | 'save-all' | 'new-play' | 'new-book' | 'sync') {
    if (!saveNeedsAccount(book.guest, action)) return false
    setSheet(null)
    setPromptDetail(null)
    setSavePrompt(true)
    return true
  }

  useEffect(() => {
    setBreakFor(null)
  }, [play?.id])

  useEffect(() => {
    if (!play || !selectedPlayerId || breakFor === selectedPlayerId) return
    const player = play.players.find((item) => item.id === selectedPlayerId)
    if (!player) return
    const fromLine = mainStroke(play, selectedPlayerId)
    const end = fromLine?.points.at(-1)
    const seen =
      fromLine?.preset && isDefensePreset(fromLine.preset)
        ? isDirectionalPreset(fromLine.preset) && end
          ? end.x <= ballXOf(play)
            ? 'left'
            : 'right'
          : null
        : fromLine
          ? routeBreakSide(fromLine)
          : null
    const side = seen ?? (player.side === 'defense' ? (player.x <= ballXOf(play) ? 'left' : 'right') : defaultBreakSide(player.x))
    setBreakSide(side)
    setBreakFor(selectedPlayerId)
  }, [play, selectedPlayerId, breakFor])

  function assign(playerId: string, preset: PresetId, side: BreakSide = breakSide) {
    if (!play) return
    stopPlayback()
    const next = applyPreset(play, playerId, preset, side)
    setSelectedPlayerId(playerId)
    setSelectedStrokeId(mainStroke(next, playerId)?.id ?? null)
    setBreakFor(playerId)
    book.update(next)
  }

  function applyBreak(side: BreakSide) {
    if (side === breakSide) return
    setBreakSide(side)
    const playerId = selectedPlayerId
    if (!play || !playerId) return
    setBreakFor(playerId)
    const main = mainStroke(play, playerId)
    if (!main) return
    stopPlayback()
    if (main.preset && isDirectionalPreset(main.preset)) {
      const next = applyPreset(play, playerId, main.preset, side)
      setSelectedStrokeId(mainStroke(next, playerId)?.id ?? null)
      book.update(next)
      return
    }
    if (!main.preset) {
      const next = mirrorPlayerRoutes(play, playerId)
      setSelectedStrokeId(mainStroke(next, playerId)?.id ?? null)
      book.update(next)
    }
  }

  function cover(playerId: string, targetId: string) {
    if (!play) return
    stopPlayback()
    const next = applyMan(play, playerId, targetId)
    setSelectedPlayerId(playerId)
    setSelectedStrokeId(mainStroke(next, playerId)?.id ?? null)
    book.update(next)
  }

  function addBook() {
    if (guestBlocked('new-book')) return
    void book.createBook()
  }

  function copyThisBook(id: string) {
    if (guestBlocked('new-book')) return
    void book.copyBook(id)
  }

  function startNew() {
    if (book.plays.length > 0 && guestBlocked('new-play')) return
    void book.create('11v11').then(() => {
      setSelectedPlayerId(null)
      setSelectedStrokeId(null)
      stopPlayback()
      setSheet('play')
    })
  }

  function finishTour() {
    markTipsSeen()
    setTourOn(false)
  }

  async function makePlaybook(choice: { title: string; style: 'print' | 'color'; plays: Play[] }) {
    setBusy(true)
    try {
      const bytes = await renderPlaybookFile({
        title: choice.title,
        plays: choice.plays,
        style: choice.style,
        date: new Date(),
      })
      const filename = `${slug(playbookTitle(choice.title))}-${choice.style}.pdf`
      const blob = new Blob([bytes.slice().buffer], { type: 'application/pdf' })
      const shared = await shareOrDownload(filename, blob)
      book.notify(shared === 'shared' ? 'Playbook ready to share' : 'Playbook saved')
      setSheet(null)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      book.notify(error instanceof Error ? error.message : 'Could not make the playbook.')
    } finally {
      setBusy(false)
    }
  }

  async function exportPdf(style: 'print' | 'color') {
    setBusy(true)
    try {
      const bytes = await renderPlaybookPdf({
        name: book.bookName,
        plays: book.plays,
        style,
        date: new Date(),
        includeNotes,
        includeAssignments,
      })
      downloadBlob(`${slug(book.bookName)}-${style}.pdf`, new Blob([bytes.slice().buffer], { type: 'application/pdf' }))
      book.notify(style === 'print' ? 'White playbook saved' : 'Color playbook saved')
    } catch (error) {
      book.notify(error instanceof Error ? error.message : 'Could not make the playbook.')
    } finally {
      setBusy(false)
    }
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
  const showWelcome = welcomeOn && !book.accountName

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
        <PlaybookSwitcher
          books={book.books}
          currentId={book.currentBookId}
          countIn={book.countInBook}
          onSwitch={book.switchBook}
          onCreate={addBook}
          onRename={(id, name) => void book.renameBook(id, name)}
          onCopy={copyThisBook}
          onDelete={(id) => void book.deleteBook(id)}
        />
        <h1>No plays yet</h1>
        <p class="empty-copy">Tap the button. Then pick how many players.</p>
        <button type="button" class="primary" onClick={() => startNew()}>
          New play
        </button>
        <button type="button" class="primary ghost" onClick={() => setSavedOpen(true)}>
          Open a saved play
        </button>
        {book.guest && !showWelcome ? (
          <button type="button" class="guest-chip" data-tip="Make a free account" onClick={() => openAccount('up')}>
            Guest — make a free account to save
          </button>
        ) : null}
        <button type="button" class="text-btn" onClick={() => openAccount('in')}>
          {book.accountName ?? 'Sign in'}
        </button>
        {sheet === 'account' ? (
          <AccountSheet
            saved={book.saved}
            start={accountMode}
            phonePlays={book.plays.length}
            onClose={() => setSheet(null)}
          />
        ) : null}
        {savePrompt ? (
          <GuestSavePrompt
            detail={promptDetail ?? undefined}
            onCreate={() => openAccount('up')}
            onClose={() => setSavePrompt(false)}
          />
        ) : null}
        {showWelcome ? (
          <WelcomeCard onCreate={() => openAccount('up')} onTry={tryFirst} onSignIn={() => openAccount('in')} />
        ) : null}
        {savedOpen ? (
          <SavedPlaysSheet
            signedIn={Boolean(book.accountName)}
            phonePlays={book.plays}
            onOpen={(next) => {
              void book.openSaved(next)
              setSavedOpen(false)
            }}
            onSignIn={() => {
              setSavedOpen(false)
              openAccount('in')
            }}
            onCreateAccount={() => {
              setSavedOpen(false)
              openAccount('up')
            }}
            onFile={() => {
              setSavedOpen(false)
              fileRef.current?.click()
            }}
            onClose={() => setSavedOpen(false)}
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
              .then(async (text) => {
                const result = await book.importJson(text)
                if (result === 'account') guestBlocked('new-book')
              })
              .catch(() => book.notify('Could not read that file.'))
            ;(event.currentTarget as HTMLInputElement).value = ''
          }}
        />
        {book.toast ? <Toast message={book.toast} undo={book.toastUndo} /> : null}
        <TipHost />
      </div>
    )
  }

  return (
    <div class="shell">
      <aside class="desk-book">
        <div class="desk-head">
          <p class="brand">Night Yard</p>
          <PlaybookSwitcher
            books={book.books}
            currentId={book.currentBookId}
            countIn={book.countInBook}
            onSwitch={(id) => {
              book.switchBook(id)
              setSelectedPlayerId(null)
              setSelectedStrokeId(null)
              stopPlayback()
            }}
            onCreate={addBook}
            onRename={(id, name) => void book.renameBook(id, name)}
            onCopy={copyThisBook}
            onDelete={(id) => void book.deleteBook(id)}
          />
        </div>
        <PlaybookList
          plays={book.plays}
          books={book.books}
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
          onCopyTo={(id, bookId) => void book.copyPlayTo(id, bookId)}
          onMoveTo={(id, bookId) => {
            void book.movePlayTo(id, bookId)
            setSelectedPlayerId(null)
            setSelectedStrokeId(null)
            stopPlayback()
          }}
          onCreateBook={addBook}
          onCreate={() => startNew()}
          saveStatus={book.syncStatus}
          saveKind={book.saveKind}
          onSaveStatus={
            book.saveKind === 'guest'
              ? () => openAccount('up')
              : book.saveKind === 'local' || book.saveKind === 'none'
                ? undefined
                : () => book.notify(SAVE_EXPLAINER)
          }
        />
      </aside>
      <div class="stage">
        <header class="top">
          <div class="title-row">
            <button type="button" class="title-btn" {...tip('Open play setup')} onClick={() => setSheet('play')}>
              <span class="brand">Night Yard</span>
              <span class="play-title">{play.name}</span>
            </button>
            <div class="header-tools">
              <button type="button" class="text-btn setup-btn" {...tip('Change the lineup')} onClick={() => setSheet('play')}>
                Setup
              </button>
              <button type="button" class="icon-btn labeled" {...tip('Undo the last change')} disabled={!book.canUndo} onClick={book.undo}>
                <UndoIcon />
                <span>Undo</span>
              </button>
              <button type="button" class="icon-btn labeled" {...tip('Put that change back')} disabled={!book.canRedo} onClick={book.redo}>
                <RedoIcon />
                <span>Redo</span>
              </button>
            </div>
            <button
              type="button"
              class={book.accountName ? 'avatar' : 'avatar guest'}
              {...tip('Your account')}
              onClick={() => openAccount('in')}
            >
              {accountInitial(book.accountName) || <PersonIcon />}
            </button>
          </div>
          <p class="sub">
            {play.formation} · {formatShort(play.format)} · Start on {ballLabel(play.los)}
          </p>
          {book.guest && !showWelcome ? (
            <button type="button" class="guest-chip" data-tip="Make a free account" onClick={() => openAccount('up')}>
              Guest — make a free account to save
            </button>
          ) : null}
          <SaveChip
            label={book.syncStatus}
            kind={book.saveKind}
            onGuest={() => openAccount('up')}
            onExplain={() => book.notify(SAVE_EXPLAINER)}
          />
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
                redrawPlayerId={redrawPlayerId}
                onRedrawDone={() => setRedrawPlayerId(null)}
              />
            </div>
          </div>
        </div>
        <div class="playback" aria-label="Playback">
          <button type="button" class="icon-btn play" {...tip(playing ? 'Pause the play' : 'Watch the play')} onClick={togglePlay}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <input
            class="scrub"
            type="range"
            min="0"
            max="1000"
            value={Math.round(t * 1000)}
            aria-label="Slide through the play"
            data-tip="Slide through the play"
            onInput={(event) => {
              setPlaying(false)
              setT(Number((event.currentTarget as HTMLInputElement).value) / 1000)
            }}
          />
          <button
            type="button"
            class="speed"
            {...tip('Change the speed')}
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          >
            {SPEED_WORD[speed]}
          </button>
        </div>
        <p class="hint">
          {fieldHint({
            tool,
            pathsOpen: sheet === 'presets',
            redraw: Boolean(redrawPlayerId),
            defense: (selected?.side ?? play.ourSide) === 'defense',
            guest: book.guest,
            selected: Boolean(selected),
          })}
        </p>
        {tool === 'draw' ? (
          <div class="coach">
            <div class="kind-row">
              {(['route', 'motion', 'block', 'run'] as StrokeKind[]).map((kind) => (
                <button key={kind} type="button" class="chip" aria-pressed={strokeKind === kind} {...tip(DRAW_TIP[kind])} onClick={() => setStrokeKind(kind)}>
                  {DRAW_WORD[kind]}
                </button>
              ))}
            </div>
          </div>
        ) : selected && play.strokes.some((stroke) => stroke.playerId === selected.id) ? (
          <div class="route-options">
            <button type="button" class="chip" {...tip('Pick a new path')} onClick={() => { setRedrawPlayerId(null); setSheet('presets') }}>
              Change route
            </button>
            {selected.side === 'defense' ? null : (
              <button type="button" class="chip" {...tip('Block in front')} onClick={() => assign(selected.id, 'block')}>
                Block
              </button>
            )}
            <button
              type="button"
              class="chip"
              {...tip('Draw a new path')}
              onClick={() => {
                setSelectedPlayerId(selected.id)
                setRedrawPlayerId(selected.id)
                setSheet(null)
              }}
            >
              Redraw
            </button>
            <button
              type="button"
              class="chip"
              {...tip('Take the path off')}
              onClick={() => {
                stopPlayback()
                book.update(removeRoute(play, selected.id))
                setSelectedStrokeId(null)
              }}
            >
              Remove route
            </button>
            <button type="button" class="chip" {...tip('Flip this path')} onClick={() => applyBreak(breakSide === 'left' ? 'right' : 'left')}>
              Flip
            </button>
            <button type="button" class="text-btn" {...tip('Change this player')} onClick={() => setSheet('player')}>
              Edit
            </button>
          </div>
        ) : selected ? (
          <div class="edit-row">
            <span class="who">
              <i style={{ background: selected.color }} />
              {selected.label}
            </span>
            <button type="button" class="text-btn" {...tip('Change this player')} onClick={() => setSheet('player')}>
              Edit
            </button>
            <button
              type="button"
              class="text-btn"
              {...tip('Erase their lines')}
              onClick={() => {
                book.update(clearPlayerStrokes(play, selected.id))
                setSelectedStrokeId(null)
                stopPlayback()
              }}
            >
              Erase
            </button>
          </div>
        ) : null}
        <nav class="toolbar" aria-label="Tools">
          <button type="button" class="tool" {...tip('Open your plays')} onClick={() => { setRedrawPlayerId(null); setSheet('book') }}>
            <BookIcon />
            Plays
          </button>
          <button type="button" class="tool" aria-pressed={tool === 'move'} {...tip('Move a player')} onClick={() => chooseTool('move')}>
            <MoveIcon />
            Move
          </button>
          <button type="button" class="tool" aria-pressed={tool === 'draw'} {...tip('Draw a path')} onClick={() => chooseTool('draw')}>
            <DrawIcon />
            Draw
          </button>
          <button type="button" class="tool" {...tip('Pick a ready path')} onClick={() => { setRedrawPlayerId(null); setSheet('presets') }}>
            <RouteIcon />
            Paths
          </button>
          <button type="button" class="tool" {...tip('More choices')} onClick={() => { setRedrawPlayerId(null); setSheet('more') }}>
            <MoreIcon />
            More
          </button>
        </nav>
      </div>
      {sheet === 'book' ? (
        <PlaysSheet
          plays={book.plays}
          books={book.books}
          currentBookId={book.currentBookId}
          onlyBook={book.books.length <= 1}
          countIn={book.countInBook}
          current={play}
          signedIn={Boolean(book.accountName)}
          saveStatus={book.syncStatus}
          saveKind={book.saveKind}
          onSaveStatus={
            book.saveKind === 'guest'
              ? () => openAccount('up')
              : book.saveKind === 'local' || book.saveKind === 'none'
                ? undefined
                : () => book.notify(SAVE_EXPLAINER)
          }
          onCreate={() => startNew()}
          onOpen={(next) => {
            if (book.plays.some((item) => item.id === next.id)) book.open(next.id)
            else void book.openSaved(next)
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
          onCopyTo={(id, bookId) => void book.copyPlayTo(id, bookId)}
          onMoveTo={(id, bookId) => void book.movePlayTo(id, bookId)}
          onSwitchBook={(id) => {
            book.switchBook(id)
            setSelectedPlayerId(null)
            setSelectedStrokeId(null)
          }}
          onCreateBook={addBook}
          onRenameBook={(id, name) => void book.renameBook(id, name)}
          onCopyBook={copyThisBook}
          onDeleteBook={(id) => void book.deleteBook(id)}
          onCategory={(category: PlayCategory) => book.update({ ...play, category })}
          onDownloadPlay={() => {
            if (guestBlocked('save-play')) return
            downloadText(`${slug(play.name)}.json`, serializePlay(play))
            book.notify('Play file saved')
          }}
          onDownloadAll={() => {
            if (guestBlocked('save-all')) return
            const current = book.books.find((item) => item.id === book.currentBookId)
            downloadText(
              `${slug(book.bookName)}.json`,
              serializePlaybookFile(
                { id: current?.id ?? book.currentBookId, name: book.bookName, updatedAt: current?.updatedAt ?? Date.now(), data: current?.data },
                book.plays,
              ),
            )
            book.notify('Playbook file saved')
          }}
          onLoadFile={() => fileRef.current?.click()}
          onSignIn={() => openAccount('in')}
          onPlaybook={() => setSheet('playbook')}
          onNeedAccount={() => {
            setSheet(null)
            setPromptDetail('A playbook uses plays saved to your account.')
            setSavePrompt(true)
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'playbook' && book.accountName ? (
        <PlaybookSheet
          localPlays={book.plays}
          defaultTitle={book.bookName}
          busy={busy}
          onClose={() => setSheet(null)}
          onMake={makePlaybook}
        />
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
          breakSide={breakSide}
          onSelect={(id) => {
            setSelectedPlayerId(id)
            const stroke = play.strokes.find((item) => item.playerId === id && item.kind !== 'motion') ?? play.strokes.find((item) => item.playerId === id)
            setSelectedStrokeId(stroke?.id ?? null)
          }}
          onBreakSide={applyBreak}
          onApply={(playerId, preset) => assign(playerId, preset)}
          onMan={cover}
          onRedraw={(playerId) => {
            setSelectedPlayerId(playerId)
            setRedrawPlayerId(playerId)
            setSheet(null)
          }}
          onRemove={(playerId) => {
            stopPlayback()
            book.update(removeRoute(play, playerId))
            setSelectedStrokeId(null)
          }}
          onFlip={() => applyBreak(breakSide === 'left' ? 'right' : 'left')}
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
          onReset={() => {
            book.reset()
            setSelectedPlayerId(null)
            setSelectedStrokeId(null)
            stopPlayback()
            setSheet(null)
          }}
          onFlip={() => {
            stopPlayback()
            book.update(flipPlay(play))
            setSheet(null)
          }}
          onShowTips={() => {
            clearTipsSeen()
            setTourOn(true)
            setSheet(null)
          }}
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
          onPdf={exportPdf}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'account' ? (
        <AccountSheet
          saved={book.saved}
          start={accountMode}
          phonePlays={book.plays.length}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {savePrompt ? (
        <GuestSavePrompt
          detail={promptDetail ?? undefined}
          onCreate={() => openAccount('up')}
          onClose={() => setSavePrompt(false)}
        />
      ) : null}
      {showWelcome ? (
        <WelcomeCard onCreate={() => openAccount('up')} onTry={tryFirst} onSignIn={() => openAccount('in')} />
      ) : null}
      {savedOpen ? (
        <SavedPlaysSheet
          signedIn={Boolean(book.accountName)}
          phonePlays={book.plays}
          onOpen={(next) => {
            void book.openSaved(next)
            setSelectedPlayerId(null)
            setSelectedStrokeId(null)
            stopPlayback()
            setSavedOpen(false)
            setSheet(null)
          }}
          onSignIn={() => {
            setSavedOpen(false)
            openAccount('in')
          }}
          onCreateAccount={() => {
            setSavedOpen(false)
            openAccount('up')
          }}
          onFile={() => {
            setSavedOpen(false)
            fileRef.current?.click()
          }}
          onClose={() => setSavedOpen(false)}
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
            .then(async (text) => {
              const result = await book.importJson(text)
              if (result === 'account') guestBlocked('new-book')
            })
            .catch((error) => book.notify(error instanceof Error ? error.message : 'Could not import that file.'))
          ;(event.currentTarget as HTMLInputElement).value = ''
        }}
      />
      {book.toast ? <Toast message={book.toast} undo={book.toastUndo} /> : null}
      {tourOn && !showWelcome ? <CoachTour onDone={finishTour} /> : null}
      <TipHost />
    </div>
  )
}

function accountInitial(name: string | null): string {
  const letter = name?.trim().charAt(0) ?? ''
  return /[a-z0-9]/i.test(letter) ? letter.toUpperCase() : ''
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path d="M5.6 19.2c1.2-3.1 3.4-4.5 6.4-4.5s5.2 1.4 6.4 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
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
