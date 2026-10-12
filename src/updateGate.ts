/** Shown when a new build is waiting and this visit still has unsaved work. */
export const UPDATE_READY = 'New version ready — tap to update'

let unsaved = false
let undoHold = false
let generation = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** An edit that a reload would throw away. Cleared once that edit is stored. */
export function setUnsavedWork(value: boolean) {
  if (value) {
    generation += 1
    if (unsaved) return
    unsaved = true
    emit()
    return
  }
  if (!unsaved) return
  unsaved = false
  emit()
}

export function unsavedGeneration(): number {
  return generation
}

/** Ignore a save that finished after a newer edit. */
export function clearUnsavedIfCurrent(seen: number) {
  if (generation !== seen) return
  setUnsavedWork(false)
}

/** The Undo toast is still on screen. Reloading would make Undo impossible. */
export function setUndoHold(value: boolean) {
  if (undoHold === value) return
  undoHold = value
  emit()
}

export function updateWouldLoseWork(): boolean {
  return unsaved || undoHold
}

export function subscribeUpdateGate(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetUpdateGate() {
  unsaved = false
  undoHold = false
  generation = 0
  listeners.clear()
}
