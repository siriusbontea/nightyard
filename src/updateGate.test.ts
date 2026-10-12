import { describe, expect, it } from 'vitest'
import { resetUpdateGate, setUndoHold, setUnsavedWork, updateWouldLoseWork, UPDATE_READY } from './updateGate'

describe('app update', () => {
  it('reloads only when nothing unsaved is sitting on the screen', () => {
    resetUpdateGate()
    expect(UPDATE_READY).toBe('New version ready — tap to update')
    expect(updateWouldLoseWork()).toBe(false)
    setUnsavedWork(true)
    expect(updateWouldLoseWork()).toBe(true)
    setUnsavedWork(false)
    setUndoHold(true)
    expect(updateWouldLoseWork()).toBe(true)
    setUndoHold(false)
    expect(updateWouldLoseWork()).toBe(false)
  })
})
