import { describe, expect, it } from 'vitest'
import { statusLine } from './sync'

describe('statusLine', () => {
  it('says Saved on the phone, and Synced only after the server catches up', () => {
    expect(statusLine(true, { signedIn: false, username: null, phase: 'local' })).toBe('Saved')
    expect(statusLine(false, { signedIn: false, username: null, phase: 'local' })).toBe('')
    expect(statusLine(true, { signedIn: true, username: 'qb1', phase: 'pending' })).toBe(
      'Saved on this phone, will sync',
    )
    expect(statusLine(true, { signedIn: true, username: 'qb1', phase: 'synced' })).toBe('Synced')
  })
})
