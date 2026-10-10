import { describe, expect, it } from 'vitest'
import { filterDeskPlays, neighborId, toggleCollapsed, visiblePlayIds } from './deskList'

describe('desktop play list', () => {
  const plays = [
    { id: 'a', name: 'Stick' },
    { id: 'b', name: 'Power' },
    { id: 'c', name: 'Cover 3' },
  ]

  it('filters by name and keeps the list order', () => {
    expect(filterDeskPlays(plays, '').map((play) => play.id)).toEqual(['a', 'b', 'c'])
    expect(filterDeskPlays(plays, '  co ').map((play) => play.id)).toEqual(['c'])
    expect(filterDeskPlays(plays, 'zzz')).toEqual([])
  })

  it('hides plays in a collapsed section and remembers the toggle', () => {
    const groups = [
      { category: 'Pass play', plays: [{ id: 'a' }, { id: 'b' }] },
      { category: 'Defense', plays: [{ id: 'c' }] },
    ]
    expect(visiblePlayIds(groups, [])).toEqual(['a', 'b', 'c'])
    const collapsed = toggleCollapsed([], 'Defense')
    expect(collapsed).toEqual(['Defense'])
    expect(visiblePlayIds(groups, collapsed)).toEqual(['a', 'b'])
    expect(toggleCollapsed(collapsed, 'Defense')).toEqual([])
  })

  it('moves up and down the open plays and stops at the ends', () => {
    const ids = ['a', 'b', 'c']
    expect(neighborId(ids, 'a', 1)).toBe('b')
    expect(neighborId(ids, 'b', -1)).toBe('a')
    expect(neighborId(ids, 'a', -1)).toBe('a')
    expect(neighborId(ids, 'c', 1)).toBe('c')
    expect(neighborId(ids, null, 1)).toBe('a')
    expect(neighborId(ids, 'missing', -1)).toBe('c')
    expect(neighborId([], 'a', 1)).toBeNull()
  })
})
