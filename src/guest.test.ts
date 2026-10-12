import { beforeEach, describe, expect, it } from 'vitest'
import {
  dismissWelcome,
  hasLegacyBook,
  isGuest,
  saveNeedsAccount,
  shouldShowWelcome,
  showWelcomeAgain,
  welcomeDismissed,
} from './guest'

describe('guest welcome', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => store.clear(),
      },
    })
  })

  it('shows the welcome once, then remembers Try it first', () => {
    expect(welcomeDismissed()).toBe(false)
    expect(shouldShowWelcome(false, false)).toBe(true)
    expect(shouldShowWelcome(true, false)).toBe(false)
    dismissWelcome()
    expect(welcomeDismissed()).toBe(true)
    expect(shouldShowWelcome(false, true)).toBe(false)
    showWelcomeAgain()
    expect(welcomeDismissed()).toBe(false)
    expect(shouldShowWelcome(false, false)).toBe(true)
  })

  it('keeps a phone that already has plays out of guest mode', () => {
    expect(hasLegacyBook(0, false)).toBe(false)
    expect(hasLegacyBook(2, false)).toBe(true)
    expect(hasLegacyBook(0, true)).toBe(true)
    expect(isGuest(false, false)).toBe(true)
    expect(isGuest(false, true)).toBe(false)
    expect(isGuest(true, false)).toBe(false)
  })

  it('asks for an account only when a guest tries to save or sync', () => {
    for (const action of ['save-play', 'save-all', 'new-play', 'new-book', 'sync'] as const) {
      expect(saveNeedsAccount(true, action)).toBe(true)
      expect(saveNeedsAccount(false, action)).toBe(false)
    }
  })
})