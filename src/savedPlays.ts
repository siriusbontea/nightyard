import { FIELD_WIDTH, displayStroke, plantedMarker } from './geometry'
import { isPlayerShown, sanitizePlay } from './play'
import { remoteRow } from './syncMerge'
import type { Play, Stroke } from './types'

/** Search shows up only after the list is long. */
export const SAVED_SEARCH_AFTER = 12

export function savedPlaysFromRecords(records: unknown[]): Play[] {
  const plays: Play[] = []
  for (const record of records) {
    if (!record || typeof record !== 'object') continue
    const row = remoteRow(record as { id: string; play_id?: unknown; deleted?: unknown; data?: unknown })
    if (!row || row.deleted) continue
    const play = sanitizePlay(row.play)
    if (play) plays.push(play)
  }
  return plays.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function showsSavedSearch(count: number): boolean {
  return count > SAVED_SEARCH_AFTER
}

export function filterSavedPlays(plays: Play[], query: string): Play[] {
  const sorted = [...plays].sort((a, b) => b.updatedAt - a.updatedAt)
  const q = query.trim().toLowerCase()
  if (!q || !showsSavedSearch(sorted.length)) return sorted
  return sorted.filter((play) => play.name.toLowerCase().includes(q))
}

/** Small field picture: players and routes only, no numbers or end-zone art. */
export function playThumb(play: Play): string {
  const scale = 4
  const ahead = 16
  const behind = 8
  const w = FIELD_WIDTH * scale
  const h = (ahead + behind) * scale
  const sx = (x: number) => (x * scale).toFixed(1)
  const sy = (y: number) => ((ahead - y) * scale).toFixed(1)
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMid slice">`]
  parts.push(`<rect width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#1b6b3c"/>`)
  const los = (ahead * scale).toFixed(1)
  parts.push(`<line x1="0" y1="${los}" x2="${w.toFixed(1)}" y2="${los}" stroke="#1D4ED8" stroke-width="2"/>`)
  for (const stroke of play.strokes) {
    const owner = play.players.find((player) => player.id === stroke.playerId)
    if (!owner || !isPlayerShown(play, owner)) continue
    parts.push(`<path d="${strokePath(displayStroke(stroke, play.players), sx, sy)}" fill="none" stroke="${owner.routeColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`)
  }
  for (const player of play.players) {
    if (!isPlayerShown(play, player)) continue
    const at = plantedMarker(player)
    parts.push(`<circle cx="${sx(at.x)}" cy="${sy(at.y)}" r="${(1.5 * scale).toFixed(1)}" fill="${player.color}"/>`)
  }
  parts.push('</svg>')
  return parts.join('')
}

function strokePath(stroke: Stroke, sx: (x: number) => string, sy: (y: number) => string): string {
  const [first, ...rest] = stroke.points
  let d = `M${sx(first.x)} ${sy(first.y)}`
  rest.forEach((point, index) => {
    const curve = stroke.curves[index]
    if (curve) d += ` Q${sx(curve.x)} ${sy(curve.y)} ${sx(point.x)} ${sy(point.y)}`
    else d += ` L${sx(point.x)} ${sy(point.y)}`
  })
  return d
}
