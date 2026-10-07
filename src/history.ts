import type { Play } from './types'

export interface History {
  past: Play[]
  present: Play
  future: Play[]
}

const LIMIT = 60

export function playsEqual(a: Play, b: Play): boolean {
  const { updatedAt: _a, ...restA } = a
  const { updatedAt: _b, ...restB } = b
  return JSON.stringify(restA) === JSON.stringify(restB)
}

export function createHistory(present: Play): History {
  return { past: [], present, future: [] }
}

export function commit(history: History, next: Play): History {
  if (playsEqual(history.present, next)) return history
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: { ...next, updatedAt: Date.now() },
    future: [],
  }
}

export function undo(history: History): History {
  const previous = history.past[history.past.length - 1]
  if (!previous) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redo(history: History): History {
  const [next, ...rest] = history.future
  if (!next) return history
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  }
}

export function canUndo(history: History): boolean {
  return history.past.length > 0
}

export function canRedo(history: History): boolean {
  return history.future.length > 0
}
