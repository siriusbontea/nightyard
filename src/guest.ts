const WELCOME_KEY = 'night-yard-welcome'

/** Saving features a guest is asked about. Editing the field is not one of them. */
export type SaveAction = 'save-play' | 'save-all' | 'new-play' | 'new-book' | 'sync'

export function welcomeDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(WELCOME_KEY) === '1'
  } catch {
    return false
  }
}

/** Remember the welcome choice on this device. Later visits do not show the card again. */
export function dismissWelcome(): void {
  try {
    globalThis.localStorage?.setItem(WELCOME_KEY, '1')
  } catch {
    /* Private mode can block storage. The card stays until it can be remembered. */
  }
}

/** After an account is deleted, the next open is a guest welcome again. */
export function showWelcomeAgain(): void {
  try {
    globalThis.localStorage?.removeItem(WELCOME_KEY)
  } catch {
    /* Ignore. */
  }
}

/** Plays already stored on this phone, including a book that was emptied on purpose. */
export function hasLegacyBook(playCount: number, seeded: boolean): boolean {
  return seeded || playCount > 0
}

/**
 * Guest: no account, and this phone has no saved book from before.
 * They can draw in this session. A book already on the phone keeps saving.
 */
export function isGuest(signedIn: boolean, legacy: boolean): boolean {
  return !signedIn && !legacy
}

/** Once per device, and never over someone who is already signed in. */
export function shouldShowWelcome(signedIn: boolean, dismissed: boolean): boolean {
  return !signedIn && !dismissed
}

/** Guests get one gentle prompt instead of writing. A saved book and a signed-in player do not. */
export function saveNeedsAccount(guest: boolean, _action: SaveAction): boolean {
  return guest
}
