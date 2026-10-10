import { describe, expect, it } from 'vitest'
import { createPlay } from './play'
import {
  adoptOwnerBook,
  bookIdForOwner,
  copyName,
  deleteBookLabel,
  placeUnbookedPlays,
  planPlaybookMerge,
  playbookName,
  playsInBook,
} from './playbooks'

describe('playbooks', () => {
  it('names a book from the playbook name, or My Playbook', () => {
    expect(playbookName(' Friday Night ')).toBe('Friday Night')
    expect(playbookName('')).toBe('My Playbook')
    expect(playbookName(null)).toBe('My Playbook')
  })

  it('puts plays that have no book into one default playbook', () => {
    const stick = createPlay({ format: '11v11', formationId: 'shotgun-trips', name: 'Stick' })
    const power = { ...createPlay({ format: '11v11', formationId: 'shotgun-trips', name: 'Power' }), bookId: 'keep' }
    const placed = placeUnbookedPlays({
      plays: [stick, power],
      books: [{ id: 'keep', name: 'Keep', updatedAt: 1, data: {} }],
      preferredName: 'Friday Night',
      bookId: 'book-ada',
      now: 50,
      currentId: 'keep',
    })
    expect(placed.changed).toBe(true)
    expect(placed.currentId).toBe('keep')
    expect(playsInBook(placed.plays, 'book-ada').map((play) => play.name)).toEqual(['Stick'])
    expect(playsInBook(placed.plays, 'keep').map((play) => play.name)).toEqual(['Power'])
    expect(placed.books.map((book) => book.name).sort()).toEqual(['Friday Night', 'Keep'])
  })

  it('uses the same account book id on every phone', () => {
    const play = createPlay({ format: '5v5', formationId: 'doubles', name: 'Mesh' })
    const local = placeUnbookedPlays({
      plays: [play],
      books: [],
      preferredName: 'Night Yard',
      bookId: 'temp',
      now: 10,
    })
    const adopted = adoptOwnerBook(local.books, local.plays, 'user1')
    expect(adopted.changed).toBe(true)
    expect(adopted.books[0].id).toBe(bookIdForOwner('user1'))
    expect(adopted.plays[0].bookId).toBe(bookIdForOwner('user1'))
    expect(adoptOwnerBook(adopted.books, adopted.plays, 'user1').changed).toBe(false)
  })

  it('keeps the newer playbook and drops one the server deleted later', () => {
    const local = { id: 'a', name: 'Phone', updatedAt: 20, data: {} }
    const remoteNewer = { id: 'a', name: 'Account', updatedAt: 30, data: {} }
    const merged = planPlaybookMerge([local], [{ bookId: 'a', deleted: false, updatedAt: 30, book: remoteNewer }], [])
    expect(merged.books[0].name).toBe('Account')
    expect(merged.upserts).toHaveLength(0)
    const pushed = planPlaybookMerge([local], [{ bookId: 'a', deleted: false, updatedAt: 10, book: remoteNewer }], [])
    expect(pushed.upserts.map((book) => book.name)).toEqual(['Phone'])
    const gone = planPlaybookMerge([local], [{ bookId: 'a', deleted: true, updatedAt: 40, book: null }], [])
    expect(gone.books).toHaveLength(0)
  })

  it('says how many plays a delete removes', () => {
    expect(deleteBookLabel('Friday', 1)).toBe('Delete Friday? This removes 1 play.')
    expect(deleteBookLabel('Friday', 4)).toBe('Delete Friday? This removes 4 plays.')
    expect(copyName('Friday Night')).toBe('Friday Night copy')
  })
})
