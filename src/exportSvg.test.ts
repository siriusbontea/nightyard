import { describe, expect, it } from 'vitest'
import { renderExportSvg, wrapText } from './exportSvg'
import { createPlay, showcasePlay } from './play'
import { COLOR_TURF_A } from './theme'

describe('export svg', () => {
  it('wraps notes onto several lines', () => {
    expect(wrapText('one two three', 7)).toEqual(['one two', 'three'])
  })

  it('prints a white sheet and a green color sheet with the play name', () => {
    const play = showcasePlay()
    const printed = renderExportSvg(play, 'print')
    const color = renderExportSvg(play, 'color')
    expect(printed).toContain('Corndog')
    expect(printed).toContain('Trips Bunch')
    expect(printed).toContain('fill="#ffffff"')
    expect(printed).not.toContain(COLOR_TURF_A)
    expect(color).toContain(COLOR_TURF_A)
    expect(color).toContain('Corndog')
    expect(color).toContain(play.notes.slice(0, 24))
    expect(color).toContain('ASSIGNMENTS')
  })

  it('can hide notes and still name an 11-on-11 personnel', () => {
    const play = createPlay({ format: '11v11', formationId: 'shotgun-trips', name: 'Trips Yankee' })
    play.notes = 'Secret'
    const svg = renderExportSvg(play, 'color', { includeNotes: false, includeAssignments: true })
    expect(svg).not.toContain('Secret')
    expect(svg).toContain('Trips Yankee')
    expect(svg).toContain('>QB<')
    expect(svg).toContain('>LT<')
    expect(svg).toContain('11v11 tackle')
  })
})
