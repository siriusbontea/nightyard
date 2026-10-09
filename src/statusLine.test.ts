import { describe, expect, it } from 'vitest'
import { saveChip, statusLine } from './sync'

describe('statusLine', () => {
  const signed = { signedIn: true, username: 'qb1', phase: 'pending' as const }

  it('says the play is on the account once the server catches up', () => {
    expect(statusLine(true, { signedIn: false, username: null, phase: 'local' }, true)).toBe('Saved')
    expect(statusLine(false, { signedIn: false, username: null, phase: 'local' }, true)).toBe('')
    expect(statusLine(true, signed, true)).toBe('Saving…')
    expect(statusLine(true, signed, false)).toBe('Saved on this phone — will sync')
    expect(statusLine(true, { ...signed, phase: 'synced' }, true)).toBe('✓ Saved to your account')
    expect(statusLine(true, { ...signed, phase: 'synced' }, false)).toBe('✓ Saved to your account')
  })

  it('tells a guest the play is not on an account', () => {
    expect(saveChip(false, { signedIn: false, username: null, phase: 'local' }, true, true)).toEqual({
      label: 'Not saved — make a free account',
      kind: 'guest',
    })
  })
})
