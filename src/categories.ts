import type { FormatId, Side } from './types'

export const PLAY_CATEGORIES = [
  'Pass play',
  'Run play',
  'Play action',
  'Trick play',
  'Defense',
  'Special teams',
  'Other',
] as const

export type PlayCategory = (typeof PLAY_CATEGORIES)[number]

/** Flag has no kicking game, so that bucket stays off the choice list. */
export function categoriesFor(format: FormatId): PlayCategory[] {
  if (format === '11v11') return [...PLAY_CATEGORIES]
  return PLAY_CATEGORIES.filter((category) => category !== 'Special teams')
}

export function isPlayCategory(value: unknown): value is PlayCategory {
  return typeof value === 'string' && (PLAY_CATEGORIES as readonly string[]).includes(value)
}

/** A defense look starts as Defense. Everything else starts as a pass. */
export function inferCategory(play: { ourSide?: Side }): PlayCategory {
  return play.ourSide === 'defense' ? 'Defense' : 'Pass play'
}

/** Stored category wins. An older play with none is inferred, not dumped into Other. */
export function categoryOf(play: { category?: string | null; ourSide?: Side }): PlayCategory {
  if (isPlayCategory(play.category)) return play.category
  return inferCategory(play)
}

export function groupPlays<T extends { category?: string | null; ourSide?: Side }>(
  plays: T[],
  filter: PlayCategory | 'All',
): { category: PlayCategory; plays: T[] }[] {
  const groups: { category: PlayCategory; plays: T[] }[] = []
  for (const category of PLAY_CATEGORIES) {
    if (filter !== 'All' && filter !== category) continue
    const items = plays.filter((play) => categoryOf(play) === category)
    if (items.length > 0) groups.push({ category, plays: items })
  }
  return groups
}
