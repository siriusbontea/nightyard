export function filterDeskPlays<T extends { name: string }>(plays: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...plays]
  return plays.filter((play) => play.name.toLowerCase().includes(q))
}

export function toggleCollapsed(collapsed: readonly string[], category: string): string[] {
  return collapsed.includes(category) ? collapsed.filter((item) => item !== category) : [...collapsed, category]
}

export function visiblePlayIds(
  groups: readonly { category: string; plays: readonly { id: string }[] }[],
  collapsed: readonly string[],
): string[] {
  const hidden = new Set(collapsed)
  const ids: string[] = []
  for (const group of groups) {
    if (hidden.has(group.category)) continue
    for (const play of group.plays) ids.push(play.id)
  }
  return ids
}

/** Next play in the open list. Stays put at the ends. */
export function neighborId(ids: readonly string[], current: string | null, direction: 1 | -1): string | null {
  if (ids.length === 0) return null
  const index = current ? ids.indexOf(current) : -1
  if (index < 0) return direction > 0 ? ids[0] : ids[ids.length - 1]
  const next = index + direction
  if (next < 0 || next >= ids.length) return ids[index]
  return ids[next]
}

const COLLAPSED_KEY = 'night-yard-collapsed'

export function readCollapsed(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(COLLAPSED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function writeCollapsed(categories: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(COLLAPSED_KEY, JSON.stringify(categories))
  } catch {
    /* Private mode can block storage. Sections open again next time. */
  }
}
