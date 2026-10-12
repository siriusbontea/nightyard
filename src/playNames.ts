import { PLAY_CATEGORIES } from './categories'
import { formationsFor } from './formations'
import { FORMATS } from './types'

/** Names we assign ourselves, like "Shotgun Trips 1" or "Punt 2". */
export function nameStems(): string[] {
  const names = new Set<string>(['New play', 'Play', ...PLAY_CATEGORIES])
  for (const format of FORMATS) {
    for (const formation of formationsFor(format.id)) names.add(formation.name)
  }
  return [...names]
}

export function isGeneratedName(name: string, stems: readonly string[] = nameStems()): boolean {
  const trimmed = name.trim()
  if (trimmed === 'New play') return true
  return stems.some((stem) => {
    if (!trimmed.startsWith(`${stem} `)) return false
    return /^\d+$/.test(trimmed.slice(stem.length + 1))
  })
}

/** Next free "Shotgun Trips 1" style name. The person can rename it later. */
export function numberedName(taken: readonly string[], label: string): string {
  const base = label.trim() || 'Play'
  const used = new Set(taken)
  let n = 1
  while (used.has(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}
