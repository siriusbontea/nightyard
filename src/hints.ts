export function fieldHint(input: {
  tool: 'move' | 'draw'
  pathsOpen: boolean
  redraw: boolean
  defense: boolean
  guest: boolean
  selected: boolean
}): string {
  if (input.redraw) return 'Draw a new path from here.'
  if (input.pathsOpen) {
    return input.defense ? 'Pick a defender, then pick a job.' : 'Pick a player, then pick a path.'
  }
  if (input.tool === 'draw') {
    return input.defense ? 'Drag from a defender to show where they go.' : 'Drag from a player to draw a route.'
  }
  if (input.defense) {
    return input.selected ? 'Drag a defender to move it. Tap a line to bend it.' : 'Drag a defender to move. Tap one to change them.'
  }
  if (input.selected) return 'Drag a player to move it. Tap a line to bend it.'
  return 'Drag a player to move. Tap a player to change them.'
}

const TIPS_KEY = 'night-yard-tips'

export function tipsSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(TIPS_KEY) === '1'
  } catch {
    return false
  }
}

export function markTipsSeen(): void {
  try {
    globalThis.localStorage?.setItem(TIPS_KEY, '1')
  } catch {
    /* Private mode can block storage. The tour can show again next time. */
  }
}

export function clearTipsSeen(): void {
  try {
    globalThis.localStorage?.removeItem(TIPS_KEY)
  } catch {
    /* Ignore. */
  }
}

/** Short plain label for a control. Eight words is the limit. */
export function tip(text: string): { 'data-tip': string; 'aria-label': string } {
  return { 'data-tip': text, 'aria-label': text }
}
