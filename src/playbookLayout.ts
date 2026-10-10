import { groupPlays, type PlayCategory } from './categories'

export const DEFAULT_PLAYBOOK_TITLE = 'Dawgs Playbook'
export const BLANK_NOTE_LINES = 4
export const QUICK_COLS = 3
export const QUICK_ROWS = 4

export interface PlaybookEntry {
  id: string
  name: string
  category: PlayCategory
}

export interface NumberedPlay extends PlaybookEntry {
  number: number
}

export interface QuickTile {
  id: string
  number: number
  name: string
}

export interface QuickBlock {
  category: PlayCategory
  tiles: QuickTile[]
}

export interface QuickPage {
  blocks: QuickBlock[]
}

export function playbookTitle(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim()
  return text || DEFAULT_PLAYBOOK_TITLE
}

export function pickCountLabel(count: number): string {
  if (count === 0) return 'No plays picked'
  if (count === 1) return '1 play picked'
  return `${count} plays picked`
}

export function toggleId(selected: readonly string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((item) => item !== id)
  return [...selected, id]
}

export function setCategory(selected: readonly string[], categoryIds: readonly string[], on: boolean): string[] {
  const next = new Set(selected)
  for (const id of categoryIds) {
    if (on) next.add(id)
    else next.delete(id)
  }
  return [...next]
}

export function categoryAllOn(selected: readonly string[], categoryIds: readonly string[]): boolean {
  return categoryIds.length > 0 && categoryIds.every((id) => selected.includes(id))
}

/** Picked plays in category order. The number is the full-page play number. */
export function numberedPlays(plays: readonly PlaybookEntry[], selectedIds: readonly string[]): NumberedPlay[] {
  const selected = new Set(selectedIds)
  const groups = groupPlays(
    plays.filter((play) => selected.has(play.id)),
    'All',
  )
  return groups.flatMap((group) => group.plays).map((play, index) => ({ ...play, number: index + 1 }))
}

/**
 * Mini diagrams, 3 across and up to 4 rows. A category header stays with its
 * tiles. A full grid continues on the next page under the same category.
 */
export function layoutQuickPages(plays: readonly NumberedPlay[]): QuickPage[] {
  const groups = groupPlays([...plays], 'All')
  const pages: QuickPage[] = []
  let blocks: QuickBlock[] = []
  let rows = 0

  function flush() {
    if (blocks.length === 0) return
    pages.push({ blocks })
    blocks = []
    rows = 0
  }

  for (const group of groups) {
    let rest: QuickTile[] = group.plays.map((play) => ({ id: play.id, number: play.number, name: play.name }))
    while (rest.length > 0) {
      const room = QUICK_ROWS - rows
      if (room < 1) flush()
      const take = Math.min(rest.length, (QUICK_ROWS - rows) * QUICK_COLS)
      blocks.push({ category: group.category, tiles: rest.slice(0, take) })
      rows += Math.ceil(take / QUICK_COLS)
      rest = rest.slice(take)
      if (rest.length > 0) flush()
    }
  }
  flush()
  return pages
}

export function wrapToWidth(text: string, widthOf: (line: string) => number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    const push = (word: string) => {
      const next = line ? `${line} ${word}` : word
      if (line && widthOf(next) > maxWidth) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    for (const word of words) {
      if (widthOf(word) <= maxWidth) {
        push(word)
        continue
      }
      let piece = ''
      for (const char of word) {
        const grown = piece + char
        if (piece && widthOf(grown) > maxWidth) {
          push(piece)
          piece = char
        } else {
          piece = grown
        }
      }
      if (piece) push(piece)
    }
    if (line) lines.push(line)
  }
  return lines
}

export function noteRows(
  notes: string,
  widthOf: (line: string) => number,
  maxWidth: number,
): { kind: 'text' | 'blank'; text: string }[] {
  const trimmed = notes.trim()
  if (!trimmed) return Array.from({ length: BLANK_NOTE_LINES }, () => ({ kind: 'blank' as const, text: '' }))
  return wrapToWidth(trimmed, widthOf, maxWidth).map((text) => ({ kind: 'text' as const, text }))
}
