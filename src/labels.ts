import { FIELD_WIDTH } from './geometry'
import type { FormatId, Player } from './types'

const MID = FIELD_WIDTH / 2

type Group = 'wr' | 'te' | 'de' | 'dt' | 'nt' | 'r' | 'lb' | 'cb'

const STEM: Record<Group, string> = {
  wr: 'WR',
  te: 'TE',
  de: 'DE',
  dt: 'DT',
  nt: 'NT',
  r: 'R',
  lb: 'LB',
  cb: 'CB',
}

/**
 * Old built-in names only. A custom name such as Slot or Mike is left alone.
 * Safe to run twice: the new names are not in this list.
 */
function groupOf(player: Player, format: FormatId): Group | null {
  const { label, role, side } = player
  if (side === 'offense' && role === 'wr' && (label === 'X' || label === 'Y' || label === 'Z' || label === 'H')) return 'wr'
  if (side === 'offense' && role === 'te' && label === 'Y') return 'te'
  if (side === 'defense' && role === 'dl' && (label === 'E' || label === 'N' || label === 'T' || label === 'J')) {
    if (format !== '11v11') return 'r'
    if (label === 'E' || label === 'J') return 'de'
    if (label === 'N' && Math.abs(player.x - MID) <= 1.5) return 'nt'
    return 'dt'
  }
  if (side === 'defense' && role === 'lb' && (label === 'W' || label === 'M' || label === '$')) return 'lb'
  if (side === 'defense' && role === 'db' && (label === 'LC' || label === 'RC')) return 'cb'
  return null
}

function claim(taken: Set<string>, stem: string, count: number): string | null {
  if (count === 1 && !taken.has(stem)) return stem
  for (let n = 1; n <= 9; n += 1) {
    const candidate = `${stem}${n}`.slice(0, 4)
    if (!taken.has(candidate)) return candidate
  }
  return null
}

/** Rename leftover built-in letters. Left to right. One player keeps the plain name. */
export function migrateBuiltinLabels(players: readonly Player[], format: FormatId): Player[] {
  const next = players.map((player) => ({ ...player }))
  const grouped = new Map<Group, Player[]>()
  for (const player of next) {
    const group = groupOf(player, format)
    if (!group) continue
    const list = grouped.get(group) ?? []
    list.push(player)
    grouped.set(group, list)
  }
  if (grouped.size === 0) return next
  const moving = new Set<Player>()
  for (const list of grouped.values()) for (const player of list) moving.add(player)
  const taken = new Set(next.filter((player) => !moving.has(player)).map((player) => player.label))
  for (const [group, list] of grouped) {
    const sorted = [...list].sort((a, b) => a.x - b.x || a.y - b.y)
    for (const player of sorted) {
      const label = claim(taken, STEM[group], sorted.length)
      if (!label) continue
      player.label = label
      taken.add(label)
    }
  }
  return next
}
