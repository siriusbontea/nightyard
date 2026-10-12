import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const deleted: string[] = []
  const auth = {
    record: { id: 'user1', username: 'kid' } as { id: string; username: string } | null,
    clear() {
      auth.record = null
    },
  }
  return { deleted, auth }
})

vi.mock('./pb', () => ({
  pb: {
    authStore: h.auth,
    collection() {
      return {
        async delete(id: string) {
          h.deleted.push(id)
        },
      }
    },
  },
}))

vi.mock('./sync', () => ({
  syncNow: async () => {},
}))

import { deleteAccount } from './account'

describe('delete account', () => {
  beforeEach(() => {
    h.deleted.length = 0
    h.auth.record = { id: 'user1', username: 'kid' }
  })

  it('deletes the signed-in user, then signs out', async () => {
    await deleteAccount()
    expect(h.deleted).toEqual(['user1'])
    expect(h.auth.record).toBeNull()
  })

  it('refuses when nobody is signed in', async () => {
    h.auth.record = null
    await expect(deleteAccount()).rejects.toThrow('Sign in first.')
    expect(h.deleted).toEqual([])
  })
})
