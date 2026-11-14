import { useEffect, useRef } from 'preact/hooks'
import { applyPositions, fieldMarkup } from '../fieldMarkup'
import { DRAW_PIXELS, FIELD_WIDTH, clamp, clampToField, dist, moveStrokePoint, plantedMarker, setStrokeCurve, simplifyPath, smoothPreview, tidyStroke, viewSize, type Camera } from '../geometry'
import { clientToField, hitTest, playerHitYards } from '../hit'
import { playerAtTime } from '../playback'
import { replaceMainStroke, replaceStroke, setStroke, translatePlayer } from '../play'
import { NIGHT } from '../theme'
import type { Play, Point, Stroke, StrokeKind } from '../types'
import { uid } from '../id'
import { tapOpensPosition } from '../playerTap'

interface FieldProps {
  play: Play
  camera: Camera
  tool: 'move' | 'draw'
  strokeKind: StrokeKind
  selectedPlayerId: string | null
  selectedStrokeId: string | null
  playbackT: number
  playing: boolean
  onCommit: (play: Play) => void
  onSelect: (playerId: string | null, strokeId: string | null) => void
  onEditPlayer: (playerId: string) => void
  onStopPlayback: () => void
  /** One new finger path for this player. Does not change the Move or Draw tool. */
  redrawPlayerId?: string | null
  onRedrawDone?: () => void
  /** Snap nearly straight pieces. Off leaves the smoothed line as drawn. */
  neat?: boolean
  /** 1 shows the whole field. Larger values zoom in without moving stored spots. */
  zoom?: number
  zoomAt?: Point | null
  onToggleZoom?: (point: Point) => void
}

type Gesture =
  | {
      type: 'draw'
      playerId: string
      kind: StrokeKind
      raw: Point[]
      pointerId: number
      snapshot: Play
      moved: boolean
    }
  | {
      type: 'move'
      playerId: string
      origin: Point
      start: Point
      pointerId: number
      snapshot: Play
      moved: boolean
      latest?: Play
    }
  | {
      type: 'reshape'
      handleKind: 'point' | 'curve' | 'bend'
      strokeId: string
      index: number
      pointerId: number
      snapshot: Play
      latest?: Play
    }

function primaryStrokeId(play: Play, playerId: string): string | null {
  const strokes = play.strokes.filter((stroke) => stroke.playerId === playerId)
  return (strokes.find((stroke) => stroke.kind !== 'motion') ?? strokes[0])?.id ?? null
}

export function Field(props: FieldProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const propsRef = useRef(props)
  const gesturing = useRef(false)
  propsRef.current = props
  const size = viewSize(props.camera)
  const zoom = props.zoom && props.zoom > 1 ? props.zoom : 1
  const focus = props.zoomAt ?? { x: FIELD_WIDTH / 2, y: 0 }
  const viewW = size.w / zoom
  const viewH = size.h / zoom
  const focusX = focus.x * props.camera.scale
  const focusY = (props.camera.ahead - focus.y) * props.camera.scale
  const viewX = clamp(focusX - viewW / 2, 0, Math.max(0, size.w - viewW))
  const viewY = clamp(focusY - viewH / 2, 0, Math.max(0, size.h - viewH))

  function paint(play: Play, showHandles: boolean, time = propsRef.current.playbackT) {
    const svg = svgRef.current
    if (!svg) return
    const current = propsRef.current
    const rect = svg.getBoundingClientRect()
    const vb = svg.viewBox.baseVal.width || viewSize(current.camera).w
    const pxPerUnit = rect.width > 40 ? rect.width / vb : 390 / vb
    const coarse = window.matchMedia('(pointer: coarse)').matches
    svg.innerHTML = fieldMarkup({
      play,
      camera: current.camera,
      theme: NIGHT,
      selectedPlayerId: current.selectedPlayerId,
      selectedStrokeId: current.selectedStrokeId,
      showHandles,
      pxPerUnit,
      coarse,
      drawMode: current.tool === 'draw',
    })
    // innerHTML does not start a load for <image href>. Set it again so the paint shows.
    for (const image of svg.querySelectorAll('image')) {
      const href = image.getAttribute('href')
      if (!href) continue
      image.setAttribute('href', '')
      image.setAttribute('href', href)
    }
    if (time > 0) {
      const positions = new Map(play.players.map((player) => [player.id, playerAtTime(player, play.strokes, time)]))
      applyPositions(svg, play, positions, current.camera)
    }
  }

  useEffect(() => {
    if (gesturing.current) return
    const showHandles = props.tool === 'move' && !props.playing && props.playbackT === 0 && Boolean(props.selectedStrokeId)
    paint(props.play, showHandles)
    // paint reads the latest props ref; dependencies are the values that change the picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.play, props.camera, props.selectedPlayerId, props.selectedStrokeId, props.tool, props.playing, props.playbackT === 0, props.zoom])

  useEffect(() => {
    if (gesturing.current) return
    const svg = svgRef.current
    if (!svg || props.playbackT <= 0) return
    const positions = new Map(props.play.players.map((player) => [player.id, playerAtTime(player, props.play.strokes, props.playbackT)]))
    applyPositions(svg, props.play, positions, props.camera)
  }, [props.playbackT, props.play, props.camera])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const yardsFor = (px: number) => {
      const rect = svg.getBoundingClientRect()
      const width = svg.viewBox.baseVal.width || 1
      if (rect.width < 1) return 2
      return (px / rect.width) * (width / propsRef.current.camera.scale)
    }

    let active: Gesture | null = null
    let lastTapAt = 0
    let lastTapPoint: Point | null = null
    let openTimer = 0

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      const current = propsRef.current
      if (current.playing || current.playbackT > 0) {
        current.onStopPlayback()
        paint(current.play, false, 0)
      }
      try {
        svg.setPointerCapture(event.pointerId)
      } catch {
        /* The pointer can end before capture on some browsers. */
      }
      const point = clientToField(svg, event.clientX, event.clientY, current.camera)
      const hit = hitTest(
        current.play,
        point,
        {
          handle: Math.max(1.15, yardsFor(window.matchMedia('(pointer: coarse)').matches ? 44 : 28)),
          player: playerHitYards(yardsFor),
          stroke: Math.max(1.05, yardsFor(18)),
          marker: Math.max(1.7, yardsFor(18)),
          cornerBias: yardsFor(30),
          minBend: yardsFor(80),
        },
        {
          showHandles: current.tool === 'move' && !current.redrawPlayerId,
          selectedStrokeId: current.selectedStrokeId,
          preferPlayers: current.tool === 'draw' || Boolean(current.redrawPlayerId),
        },
      )
      if (hit.type === 'handle') {
        gesturing.current = true
        active = {
          type: 'reshape',
          handleKind: hit.kind,
          strokeId: hit.strokeId,
          index: hit.index,
          pointerId: event.pointerId,
          snapshot: current.play,
        }
        return
      }
      if (hit.type === 'player' && current.redrawPlayerId && hit.id !== current.redrawPlayerId) {
        current.onRedrawDone?.()
      }
      if (hit.type === 'player' && (current.tool === 'draw' || current.redrawPlayerId === hit.id)) {
        const player = current.play.players.find((item) => item.id === hit.id)
        if (!player) return
        const home = plantedMarker(player)
        gesturing.current = true
        active = {
          type: 'draw',
          playerId: player.id,
          kind: current.redrawPlayerId === player.id ? 'route' : current.strokeKind,
          raw: [{ x: home.x, y: home.y }],
          pointerId: event.pointerId,
          snapshot: current.play,
          moved: false,
        }
        current.onSelect(player.id, primaryStrokeId(current.play, player.id))
        return
      }
      if (hit.type === 'player') {
        const player = current.play.players.find((item) => item.id === hit.id)
        if (!player) return
        gesturing.current = true
        active = {
          type: 'move',
          playerId: player.id,
          origin: point,
          start: { x: player.x, y: player.y },
          pointerId: event.pointerId,
          snapshot: current.play,
          moved: false,
        }
        return
      }
      if (hit.type === 'stroke') {
        const stroke = current.play.strokes.find((item) => item.id === hit.id)
        current.onSelect(stroke?.playerId ?? null, hit.id)
        return
      }
      current.onSelect(null, null)
    }

    const onMove = (event: PointerEvent) => {
      const gesture = active
      if (!gesture || event.pointerId !== gesture.pointerId) return
      const current = propsRef.current
      const point = clientToField(svg, event.clientX, event.clientY, current.camera)
      if (gesture.type === 'draw') {
        const last = gesture.raw[gesture.raw.length - 1]
        const sample = clampToField(point, current.play.los)
        if (dist(last, sample) >= Math.max(0.05, yardsFor(DRAW_PIXELS.sample))) {
          gesture.raw.push(sample)
          gesture.moved = true
        }
        if (gesture.raw.length < 2) return
        let draftPoints = smoothPreview(gesture.raw)
        let draftCurves: (Point | null)[] = draftPoints.slice(1).map(() => null)
        if (current.neat !== false && gesture.raw.length >= 3) {
          const simple = simplifyPath(gesture.raw, Math.max(0.12, yardsFor(DRAW_PIXELS.epsilon)), {
            cornerWindow: yardsFor(DRAW_PIXELS.cornerWindow),
            cornerDegrees: DRAW_PIXELS.cornerDegrees,
            minLeg: yardsFor(DRAW_PIXELS.minLeg),
            maxPoints: DRAW_PIXELS.maxPoints,
          })
          if (simple.points.length >= 2) {
            const tidy = tidyStroke(simple.points, simple.curves)
            draftPoints = tidy.points
            draftCurves = tidy.curves
          }
        }
        const draft: Stroke = {
          id: 'draft',
          playerId: gesture.playerId,
          kind: gesture.kind,
          points: draftPoints,
          curves: draftCurves,
          preset: null,
        }
        const preview = draft.kind === 'motion' ? setStroke(gesture.snapshot, draft) : replaceMainStroke(gesture.snapshot, draft)
        paint(preview, false, 0)
        return
      }
      if (gesture.type === 'move') {
        const slop = Math.max(0.85, yardsFor(14))
        if (dist(gesture.origin, point) <= slop) return
        gesture.moved = true
        const x = clamp(gesture.start.x + (point.x - gesture.origin.x), 1.4, FIELD_WIDTH - 1.4)
        const y = clamp(gesture.start.y + (point.y - gesture.origin.y), -16, 27)
        gesture.latest = translatePlayer(gesture.snapshot, gesture.playerId, x, y)
        paint(gesture.latest, false, 0)
        return
      }
      const stroke = gesture.snapshot.strokes.find((item) => item.id === gesture.strokeId)
      if (!stroke) return
      const held = clampToField(point, gesture.snapshot.los)
      const next =
        gesture.handleKind === 'point'
          ? moveStrokePoint(stroke, gesture.index, held)
          : setStrokeCurve(stroke, gesture.index, bendOrStraight(stroke, gesture.index, held))
      gesture.latest = replaceStroke(gesture.snapshot, next)
      paint(gesture.latest, true, 0)
    }

    const onUp = (event: PointerEvent) => {
      if (!active || event.pointerId !== active.pointerId) return
      const finished = active
      active = null
      gesturing.current = false
      const current = propsRef.current
      if (finished.type === 'draw') {
        const length = finished.raw.reduce((sum, point, index) => (index === 0 ? 0 : sum + dist(finished.raw[index - 1], point)), 0)
        if (!finished.moved || length < 0.9 || finished.raw.length < 2) {
          current.onSelect(finished.playerId, primaryStrokeId(finished.snapshot, finished.playerId))
          paint(finished.snapshot, current.tool === 'move', 0)
          return
        }
        const simple = simplifyPath(finished.raw, Math.max(0.12, yardsFor(DRAW_PIXELS.epsilon)), {
          cornerWindow: yardsFor(DRAW_PIXELS.cornerWindow),
          cornerDegrees: DRAW_PIXELS.cornerDegrees,
          minLeg: yardsFor(DRAW_PIXELS.minLeg),
          maxPoints: DRAW_PIXELS.maxPoints,
        })
        const player = finished.snapshot.players.find((item) => item.id === finished.playerId)
        if (!player || simple.points.length < 2) {
          current.onSelect(finished.playerId, null)
          paint(finished.snapshot, false, 0)
          return
        }
        const home = plantedMarker(player)
        const tidy = current.neat === false ? simple : tidyStroke(simple.points, simple.curves)
        tidy.points[0] = { x: home.x, y: home.y }
        tidy.points = tidy.points.map((spot, index) => (index === 0 ? spot : clampToField(spot, finished.snapshot.los)))
        const stroke: Stroke = {
          id: uid(),
          playerId: player.id,
          kind: finished.kind,
          points: tidy.points,
          curves: tidy.curves,
          preset: null,
        }
        current.onSelect(player.id, stroke.id)
        const next = stroke.kind === 'motion' ? setStroke(finished.snapshot, stroke) : replaceMainStroke(finished.snapshot, stroke)
        current.onCommit(next)
        if (current.redrawPlayerId) current.onRedrawDone?.()
        return
      }
      if (finished.type === 'move') {
        if (!finished.moved || !finished.latest) {
          const already = current.selectedPlayerId === finished.playerId
          const lineId = primaryStrokeId(finished.snapshot, finished.playerId)
          const now = Date.now()
          if (lastTapPoint && now - lastTapAt < 320 && dist(lastTapPoint, finished.origin) < 1.5) {
            window.clearTimeout(openTimer)
            lastTapAt = 0
            lastTapPoint = null
            current.onToggleZoom?.(finished.origin)
            current.onSelect(finished.playerId, lineId)
            paint(finished.snapshot, true, 0)
            return
          }
          lastTapAt = now
          lastTapPoint = finished.origin
          current.onSelect(finished.playerId, lineId)
          if (!lineId && tapOpensPosition(event.pointerType, already)) {
            window.clearTimeout(openTimer)
            const playerId = finished.playerId
            openTimer = window.setTimeout(() => {
              if (lastTapAt !== now) return
              propsRef.current.onEditPlayer(playerId)
            }, 300)
          }
          paint(finished.snapshot, true, 0)
          return
        }
        current.onSelect(finished.playerId, primaryStrokeId(finished.latest, finished.playerId))
        current.onCommit(finished.latest)
        return
      }
      if (finished.latest) current.onCommit(finished.latest)
      else paint(finished.snapshot, true, 0)
    }

    const onCancel = (event: PointerEvent) => {
      if (!active || event.pointerId !== active.pointerId) return
      const finished = active
      active = null
      gesturing.current = false
      paint(finished.snapshot, propsRef.current.tool === 'move', 0)
    }

    svg.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    const blockMenu = (event: Event) => event.preventDefault()
    svg.addEventListener('contextmenu', blockMenu)
    return () => {
      window.clearTimeout(openTimer)
      svg.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      svg.removeEventListener('contextmenu', blockMenu)
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      class="field"
      viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${props.play.name} field`}
    />
  )
}

function bendOrStraight(stroke: Stroke, index: number, point: Point): Point | null {
  const a = stroke.points[index]
  const b = stroke.points[index + 1]
  if (!a || !b) return point
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  return dist(point, mid) < 0.45 ? null : point
}
