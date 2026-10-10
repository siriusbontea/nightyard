import { shapeFor } from './formations'
import type { FormatId, Play, Player, Role, Side } from './types'

export interface PositionOption {
  id: string
  label: string
  role: Role
  side: Side
  formats: readonly FormatId[]
}

const ALL: FormatId[] = ['5v5', '6v6', '7v7', '8v8', '9v9', '11v11']
const FLAG: FormatId[] = ['5v5', '6v6', '7v7', '8v8', '9v9']
const FROM_7: FormatId[] = ['7v7', '8v8', '9v9', '11v11']
const FROM_8: FormatId[] = ['8v8', '9v9', '11v11']
const TACKLE: FormatId[] = ['11v11']

/** Short list. Flag hides tackle-only spots such as tight end and tackle. */
export const POSITIONS: readonly PositionOption[] = [
  { id: 'qb', label: 'QB', role: 'qb', side: 'offense', formats: ALL },
  { id: 'rb', label: 'RB', role: 'rb', side: 'offense', formats: ALL },
  { id: 'fb', label: 'FB', role: 'fb', side: 'offense', formats: TACKLE },
  { id: 'te', label: 'TE', role: 'te', side: 'offense', formats: TACKLE },
  { id: 'wr', label: 'WR', role: 'wr', side: 'offense', formats: ALL },
  { id: 'c', label: 'C', role: 'center', side: 'offense', formats: ALL },
  { id: 'g', label: 'G', role: 'ol', side: 'offense', formats: FROM_7 },
  { id: 't', label: 'T', role: 'ol', side: 'offense', formats: FROM_8 },
  { id: 'k', label: 'K', role: 'qb', side: 'offense', formats: TACKLE },
  { id: 'p', label: 'P', role: 'qb', side: 'offense', formats: TACKLE },
  { id: 'ls', label: 'LS', role: 'center', side: 'offense', formats: TACKLE },
  { id: 'h', label: 'H', role: 'rb', side: 'offense', formats: TACKLE },
  { id: 'kr', label: 'KR', role: 'rb', side: 'offense', formats: TACKLE },
  { id: 'pr', label: 'PR', role: 'rb', side: 'offense', formats: TACKLE },
  { id: 'gun', label: 'Gun', role: 'wr', side: 'offense', formats: TACKLE },
  { id: 'wing', label: 'Wing', role: 'te', side: 'offense', formats: TACKLE },
  { id: 'lb', label: 'LB', role: 'lb', side: 'defense', formats: ALL },
  { id: 'cb', label: 'CB', role: 'db', side: 'defense', formats: ALL },
  { id: 's', label: 'S', role: 'db', side: 'defense', formats: ALL },
  { id: 'fs', label: 'FS', role: 'db', side: 'defense', formats: TACKLE },
  { id: 'ss', label: 'SS', role: 'db', side: 'defense', formats: TACKLE },
  { id: 'nb', label: 'NB', role: 'db', side: 'defense', formats: TACKLE },
  { id: 'r', label: 'R', role: 'dl', side: 'defense', formats: FLAG },
  { id: 'de', label: 'DE', role: 'dl', side: 'defense', formats: TACKLE },
  { id: 'dt', label: 'DT', role: 'dl', side: 'defense', formats: TACKLE },
  { id: 'nt', label: 'NT', role: 'dl', side: 'defense', formats: TACKLE },
  { id: 'dl', label: 'DL', role: 'dl', side: 'defense', formats: TACKLE },
]

export function positionsFor(format: FormatId, side: Side): PositionOption[] {
  return POSITIONS.filter((option) => option.side === side && option.formats.includes(format))
}

export function labelIsStem(label: string, stem: string): boolean {
  return label === stem || new RegExp(`^${stem}[1-9]$`).test(label)
}

const NUMBER_FROM_ONE = new Set(['WR', 'LB', 'CB', 'DE', 'DT', 'R', 'NT', 'FS', 'SS', 'NB'])

/** TE, then TE2, without touching another player's name. */
export function nextLabel(players: readonly Player[], selfId: string, stem: string): string {
  const used = new Set(players.filter((player) => player.id !== selfId).map((player) => player.label))
  if (NUMBER_FROM_ONE.has(stem)) {
    const family = players.filter((player) => player.id !== selfId && labelIsStem(player.label, stem))
    if (family.length === 0 && !used.has(stem)) return stem
    for (let n = 1; n <= 9; n += 1) {
      const candidate = `${stem}${n}`.slice(0, 4)
      if (!used.has(candidate)) return candidate
    }
    return stem.slice(0, 4)
  }
  if (!used.has(stem)) return stem
  for (let n = 2; n <= 9; n += 1) {
    const candidate = `${stem}${n}`.slice(0, 4)
    if (!used.has(candidate)) return candidate
  }
  return stem.slice(0, 4)
}

export function positionSelected(player: Player, option: PositionOption, options: readonly PositionOption[]): boolean {
  if (player.role !== option.role) return false
  const sameRole = options.filter((item) => item.role === option.role)
  if (sameRole.length === 1) return true
  return labelIsStem(player.label, option.label)
}

/** Change the spot. The roster size stays the same, and the side stays the same. */
export function applyPosition(play: Play, player: Player, positionId: string): Player {
  const options = positionsFor(play.format, player.side)
  const option = options.find((item) => item.id === positionId)
  if (!option) return player
  const keep = positionSelected(player, option, options)
  return {
    ...player,
    role: option.role,
    shape: shapeFor(option.role),
    label: keep ? player.label : nextLabel(play.players, player.id, option.label).slice(0, 4),
  }
}
