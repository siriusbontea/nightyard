import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { DEFAULT_LOS } from '../fieldMarks'
import { FIELD_WIDTH, cameraForBox } from '../geometry'
import {
  applyMan,
  applyPreset,
  ballLabel,
  ballXOf,
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
import { formationById } from '../formations'
import { isGeneratedName, numberedName } from '../playNames'
import { fieldHint, clearTipsSeen, markTipsSeen, tip, tipsSeen } from '../hints'
import { HelmetBadge } from './HelmetBadge'
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
import { useAppUpdate } from '../useAppUpdate'
import { UPDATE_READY } from '../updateGate'
import { dismissInstallTip, installTipDismissed, isInstalled, noteVisit, promptInstall, shouldShowInstallTip, useInstallOffer } from '../install'
import { InstallGuide, InstallTip } from './InstallSheet'

type Tool = 'move' | 'draw'
type SheetId = null | 'book' | 'presets' | 'player' | 'more' | 'export' | 'play' | 'account' | 'playbook'
const SPEEDS = [0.5, 1, 1.5] as const
const SPEED_WORD: Record<(typeof SPEEDS)[number], string> = { 0.5: 'Slow', 1: 'Normal', 1.5: 'Fast' }
const DRAW_SHORT: Record<StrokeKind, string> = {
  route: 'Route',
  motion: 'Walk in',
  block: 'Block',
  run: 'Run',
}
function KindChoices(props: { format: Play['format']; strokeKind: StrokeKind; onPick: (kind: StrokeKind) => void }) {
  const kinds = (props.format === '11v11' ? ['route', 'motion', 'block', 'run'] : ['route', 'motion', 'run']) as StrokeKind[]
  return (
    <div class="kind-row">
      {kinds.map((kind) => (
        <button key={kind} type="button" class="chip" aria-pressed={props.strokeKind === kind} {...tip(DRAW_TIP[kind])} onClick={() => props.onPick(kind)}>
          {DRAW_SHORT[kind]}
        </button>
      ))}
    </div>
  )
}

function NeatSwitch(props: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" class="neat-switch" role="switch" aria-checked={props.on} data-tip="Straighten nearly straight lines" onClick={props.onToggle}>
      <span class="switch-box" aria-hidden="true">{props.on ? '✓' : ''}</span>
      Neat
    </button>
  )
}

const DRAW_TIP: Record<StrokeKind, string> = {
  route: 'Draw a route',
  motion: 'Move before the snap',
  block: 'Block',
  run: 'Run',
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
  const appUpdate = useAppUpdate()
  const install = useInstallOffer()
  const [installGuide, setInstallGuide] = useState(false)
  const [installTipOff, setInstallTipOff] = useState(false)
  function takeUpdate() {
    void book.flushSave().finally(() => appUpdate.apply())
  }
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
  const [visit, setVisit] = useState(1)
  const [closer, setCloser] = useState(false)
  const [zoomAt, setZoomAt] = useState<{ x: number; y: number } | null>(null)
  const [neat, setNeat] = useState(() => {
    try {
      return globalThis.localStorage?.getItem('night-yard-neat') !== '0'
    } catch {
      return true
    }
  })
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
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (sheet || !play || !selectedPlayerId) return
        if (!play.strokes.some((stroke) => stroke.playerId === selectedPlayerId)) return
        event.preventDefault()
        dropRoute(selectedPlayerId)
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

  function dropRoute(playerId: string) {
    if (!play || !play.strokes.some((stroke) => stroke.playerId === playerId)) return
    stopPlayback()
    book.update(removeRoute(play, playerId))
    setSelectedStrokeId(null)
    book.notify('Removed. Tap Undo.', () => book.undo())
  }

  function openAccount(mode: 'in' | 'up') {
    setAccountMode(mode)
    setSavePrompt(false)
    setSheet('account')
  }

  async function afterAccountDeleted() {
    await book.forgetAccount()
    setWelcomeOn(true)
    setTourOn(false)
    setSheet(null)
    setSelectedPlayerId(null)
    setSelectedStrokeId(null)
    stopPlayback()
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
    setVisit(noteVisit())
  }, [])

  useEffect(() => {
    if (!play || tipsSeen() || welcomeOn) return
    setTourOn(true)
  }, [play?.id, welcomeOn])

  function toggleNeat() {
    setNeat((value) => {
      const next = !value
      try {
        globalThis.localStorage?.setItem('night-yard-neat', next ? '1' : '0')
      } catch {
        /* The choice lasts for this visit. */
      }
      return next
    })
  }

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
    const flipped = () => book.notify('Flipped. Tap Undo.', () => book.undo())
    if (main.preset && isDirectionalPreset(main.preset)) {
      const next = applyPreset(play, playerId, main.preset, side)
      setSelectedStrokeId(mainStroke(next, playerId)?.id ?? null)
      book.update(next)
      flipped()
      return
    }
    if (!main.preset) {
      const next = mirrorPlayerRoutes(play, playerId)
      setSelectedStrokeId(mainStroke(next, playerId)?.id ?? null)
      book.update(next)
      flipped()
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
    void book.create(play?.format ?? '11v11', play?.los).then(() => {
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

  function addToHome() {
    setSheet(null)
    if (install.kind === 'prompt') {
      void promptInstall()
      return
    }
    setInstallGuide(true)
  }

  function hideInstallTip() {
    dismissInstallTip()
    setInstallTipOff(true)
  }

  function showInstallHelp() {
    hideInstallTip()
    if (install.kind === 'prompt') {
      void promptInstall()
      return
    }
    setInstallGuide(true)
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
  const showWelcomeCard = showWelcome && sheet !== 'account' && !savePrompt

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
        <button type="button" class="text-btn" onClick={() => openAccount('in')}>
          {book.accountName ?? 'Sign in'}
        </button>
        {sheet === 'account' ? (
          <AccountSheet
            saved={book.saved}
            start={accountMode}
            phonePlays={book.plays.length}
            onDeleted={afterAccountDeleted}
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
        {showWelcomeCard ? (
          <WelcomeCard onCreate={() => openAccount('up')} onTry={tryFirst} onSignIn={() => openAccount('in')} />
        ) : null}
        {savedOpen ? (
          <SavedPlaysSheet
            signedIn={Boolean(book.accountName)}
            phonePlays={book.allPlays}
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
        <div class="file-clip">
        <input
          ref={fileRef}
          class="file"
          type="file"
          tabindex={-1}
          aria-hidden="true"
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
        </div>
        {appUpdate.show ? <UpdateToast onApply={takeUpdate} /> : null}
        {book.toast ? <Toast message={book.toast} undo={book.toastUndo} lifted={appUpdate.show} /> : null}
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
          example={book.guest}
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
              <HelmetBadge letter={accountInitial(book.accountName)} />
            </button>
          </div>
          <p class="sub">
            {play.formation} · {formatShort(play.format)} · Start on {ballLabel(play.los)}
          </p>
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
                strokeKind={play.format !== '11v11' && strokeKind === 'block' ? 'route' : strokeKind}
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
                neat={neat}
                zoom={closer ? 1.75 : 1}
                zoomAt={zoomAt}
                onToggleZoom={(point) => {
                  setZoomAt(point)
                  setCloser((value) => !value)
                }}
              />
            </div>
            <button
              type="button"
              class="zoom-btn"
              aria-pressed={closer}
              data-tip={closer ? 'Show the whole field' : 'See the players up close'}
              onClick={() => {
                setZoomAt({ x: FIELD_WIDTH / 2, y: 0 })
                setCloser((value) => !value)
              }}
            >
              {closer ? 'Whole field' : 'Closer'}
            </button>
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
          <div class="speeds" role="group" aria-label="Speed">
            {SPEEDS.map((value) => (
              <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)}>
                {SPEED_WORD[value]}
              </button>
            ))}
          </div>
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
        {tool === 'draw' && selected && play.strokes.some((stroke) => stroke.playerId === selected.id) ? (
          <div class="kind-float">
            <KindChoices format={play.format} strokeKind={strokeKind} onPick={setStrokeKind} />
            <NeatSwitch on={neat} onToggle={toggleNeat} />
          </div>
        ) : null}
        <div class="action-slot">
          {selected && play.strokes.some((stroke) => stroke.playerId === selected.id) ? (
            <div class="route-actions">
              <button
                type="button"
                class="chip"
                data-tip="Draw a new path"
                onClick={() => {
                  setSelectedPlayerId(selected.id)
                  setRedrawPlayerId(selected.id)
                  setSheet(null)
                  chooseTool('draw')
                }}
              >
                Redraw
              </button>
              <button type="button" class="chip" data-tip="Flip left/right" onClick={() => applyBreak(breakSide === 'left' ? 'right' : 'left')}>
                Flip
              </button>
              <button type="button" class="chip trash" data-tip="Remove this route" onClick={() => dropRoute(selected.id)}>
                <TrashIcon />
                Delete
              </button>
            </div>
          ) : tool === 'draw' ? (
            <>
              <KindChoices format={play.format} strokeKind={strokeKind} onPick={setStrokeKind} />
              <NeatSwitch on={neat} onToggle={toggleNeat} />
            </>
          ) : selected ? (
            <button type="button" class="chip" {...tip('Change this player')} onClick={() => setSheet('player')}>
              Edit {selected.label}
            </button>
          ) : (
            <span class="action-empty">Pick a player on the field.</span>
          )}
        </div>
        <nav class="toolbar" aria-label="Tools">
          <button type="button" class="tool" data-tour="plays" {...tip('Open your plays')} onClick={() => { setRedrawPlayerId(null); setSheet('book') }}>
            <BookIcon />
            Plays
          </button>
          <button type="button" class="tool" aria-pressed={tool === 'move'} {...tip('Move a player')} onClick={() => chooseTool('move')}>
            <MoveIcon />
            Move
          </button>
          <button type="button" class="tool" data-tour="draw" aria-pressed={tool === 'draw'} {...tip('Draw a path')} onClick={() => chooseTool('draw')}>
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
          example={book.guest}
          onPlaybook={() => setSheet('playbook')}
          onNeedAccount={() => {
            setSheet(null)
            setPromptDetail('Make a free account first. Then your plays save, and you can make a PDF.')
            setSavePrompt(true)
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'playbook' && book.accountName ? (
        <PlaybookSheet
          localPlays={book.allPlays}
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
            const lineupChanged = next.format !== play.format || next.formationId !== play.formationId
            if (lineupChanged) {
              setSelectedPlayerId(null)
              setSelectedStrokeId(null)
            }
            const renamed =
              lineupChanged && (isGeneratedName(play.name) || isGeneratedName(next.name)) && (next.name === play.name || isGeneratedName(next.name))
                ? {
                    ...next,
                    name: numberedName(
                      book.plays.filter((item) => item.id !== play.id).map((item) => item.name),
                      formationById(next.format, next.formationId).name,
                    ),
                  }
                : next
            book.update(renamed)
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
          onAskCover={() => book.notify('Tap who to cover.')}
          onMan={cover}
          onRedraw={(playerId) => {
            setSelectedPlayerId(playerId)
            setRedrawPlayerId(playerId)
            setSheet(null)
          }}
          onRemove={(playerId) => {
            dropRoute(playerId)
          }}
          onFlip={() => applyBreak(breakSide === 'left' ? 'right' : 'left')}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'player' && selected ? (
        <PlayerSheet
          play={play}
          player={selected}
          onChange={(player, reason) => {
            book.update(updatePlayer(play, player.id, player))
            if (reason === 'position') book.notify('Changed. Tap Undo.', () => book.undo())
          }}
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
          showInstall={!install.installed}
          onInstall={addToHome}
          onChange={(next) => book.update(next)}
          onDuplicate={() => {
            book.duplicate(play.id)
            setSheet(null)
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
          onDeleted={afterAccountDeleted}
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
      {showWelcomeCard ? (
        <WelcomeCard onCreate={() => openAccount('up')} onTry={tryFirst} onSignIn={() => openAccount('in')} />
      ) : null}
      {savedOpen ? (
        <SavedPlaysSheet
          signedIn={Boolean(book.accountName)}
          phonePlays={book.allPlays}
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
      <div class="file-clip">
      <input
        ref={fileRef}
        class="file"
        type="file"
        tabindex={-1}
        aria-hidden="true"
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
      </div>
      {appUpdate.show ? <UpdateToast onApply={takeUpdate} /> : null}
      {book.toast ? <Toast message={book.toast} undo={book.toastUndo} lifted={appUpdate.show} /> : null}
      {tourOn && !showWelcome ? <CoachTour onDone={finishTour} /> : null}
      {installGuide ? <InstallGuide ios={install.ios} onClose={() => setInstallGuide(false)} /> : null}
      {shouldShowInstallTip({
        installed: install.installed || isInstalled(),
        dismissed: installTipOff || installTipDismissed(),
        welcome: showWelcome,
        tourOpen: tourOn,
        hasPlay: true,
        tourDone: tipsSeen(),
        returning: visit >= 2,
      }) ? (
        <InstallTip onShow={showInstallHelp} onLater={hideInstallTip} />
      ) : null}
      <TipHost />
    </div>
  )
}

function accountInitial(name: string | null): string {
  const letter = name?.trim().charAt(0) ?? ''
  return /[a-z0-9]/i.test(letter) ? letter.toUpperCase() : ''
}

function UpdateToast(props: { onApply: () => void }) {
  return (
    <button type="button" class="toast" onClick={props.onApply}>
      {UPDATE_READY}
    </button>
  )
}

function Toast(props: { message: string; undo: (() => void) | null; lifted?: boolean }) {
  return (
    <div class={props.lifted ? 'toast toast-next' : 'toast'} role="status">
      <span>{props.message}</span>
      {props.undo ? (
        <button type="button" class="toast-undo" onClick={props.undo}>
          Undo
        </button>
      ) : null}
    </div>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M5 7h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <path d="M9 7V5.5h6V7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M7.5 7l.8 12h7.4l.8-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
      <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
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
