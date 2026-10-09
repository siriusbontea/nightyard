import { describe, expect, it } from 'vitest'
import { createPlay, showcasePlay } from './play'
import { filterSavedPlays, playThumb, savedPlaysFromRecords, showsSavedSearch } from './savedPlays'

describe('saved plays from the server', () => {
  it('keeps live plays, newest first, and drops deleted rows', () => {
    const corndog = showcasePlay()
    const flood = createPlay({ format: '7v7', formationId: 'spread', name: 'Flood' })
    flood.updatedAt = corndog.updatedAt - 5000
    const gone = createPlay({ format: '5v5', formationId: 'doubles', name: 'Gone' })
    const plays = savedPlaysFromRecords([
      { id: 'a', play_id: flood.id, deleted: false, data: flood },
      { id: 'b', play_id: gone.id, deleted: true, data: gone },
      { id: 'c', play_id: corndog.id, deleted: false, data: corndog },
      { id: 'd', play_id: 'nope', deleted: false, data: { name: 'Broken' } },
    ])
    expect(plays.map((play) => play.name)).toEqual(['Corndog', 'Flood'])
  })

  it('offers search only after 12 plays, and filters by name', () => {
    expect(showsSavedSearch(12)).toBe(false)
    expect(showsSavedSearch(13)).toBe(true)
    const plays = Array.from({ length: 13 }, (_, index) =>
      createPlay({ format: '5v5', formationId: 'doubles', name: index === 4 ? 'Mesh' : `Play ${index}` }),
    )
    expect(filterSavedPlays(plays, '').map((play) => play.name)).toHaveLength(13)
    expect(filterSavedPlays(plays, 'mesh').map((play) => play.name)).toEqual(['Mesh'])
    expect(filterSavedPlays(plays.slice(0, 12), 'mesh').map((play) => play.name)).toHaveLength(12)
  })

  it('draws a small picture of the players and a route', () => {
    const svg = playThumb(showcasePlay())
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<circle')
    expect(svg).toContain('<path')
    expect(svg).not.toContain('Corndog')
  })
})