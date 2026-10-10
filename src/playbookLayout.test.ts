import { describe, expect, it } from 'vitest'
import {
  BLANK_NOTE_LINES,
  categoryAllOn,
  layoutQuickPages,
  noteRows,
  numberedPlays,
  pickCountLabel,
  playbookTitle,
  setCategory,
  toggleId,
  wrapToWidth,
  type PlaybookEntry,
} from './playbookLayout'

function entry(id: string, category: PlaybookEntry['category'], name = id): PlaybookEntry {
  return { id, name, category }
}

describe('playbook picker', () => {
  it('uses Dawgs Playbook when the title is blank', () => {
    expect(playbookTitle('')).toBe('Dawgs Playbook')
    expect(playbookTitle('   ')).toBe('Dawgs Playbook')
    expect(playbookTitle(' Friday Night ')).toBe('Friday Night')
  })

  it('counts picked plays in plain words', () => {
    expect(pickCountLabel(0)).toBe('No plays picked')
    expect(pickCountLabel(1)).toBe('1 play picked')
    expect(pickCountLabel(4)).toBe('4 plays picked')
  })

  it('toggles one play and a whole category', () => {
    expect(toggleId(['a'], 'b').sort()).toEqual(['a', 'b'])
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b'])
    expect(setCategory(['a'], ['b', 'c'], true).sort()).toEqual(['a', 'b', 'c'])
    expect(setCategory(['a', 'b', 'c'], ['b', 'c'], false)).toEqual(['a'])
    expect(categoryAllOn(['b', 'c'], ['b', 'c'])).toBe(true)
    expect(categoryAllOn(['b'], ['b', 'c'])).toBe(false)
    expect(categoryAllOn([], [])).toBe(false)
  })
})

describe('playbook order', () => {
  const plays = [
    entry('d', 'Defense', 'Cover 3'),
    entry('r', 'Run play', 'Power'),
    entry('p', 'Pass play', 'Stick'),
    entry('skip', 'Pass play', 'Hidden'),
  ]

  it('numbers picked plays in category order, matching the full pages', () => {
    const ordered = numberedPlays(plays, ['d', 'r', 'p'])
    expect(ordered.map((play) => play.name)).toEqual(['Stick', 'Power', 'Cover 3'])
    expect(ordered.map((play) => play.number)).toEqual([1, 2, 3])
    const tiles = layoutQuickPages(ordered).flatMap((page) => page.blocks.flatMap((block) => block.tiles))
    expect(tiles.map((tile) => tile.number)).toEqual([1, 2, 3])
    expect(tiles.map((tile) => tile.id)).toEqual(['p', 'r', 'd'])
  })

  it('packs a category into a 3 by 4 grid and continues on the next page', () => {
    const many = Array.from({ length: 13 }, (_, index) => entry(`p${index}`, 'Pass play', `Pass ${index + 1}`))
    const ordered = numberedPlays(many, many.map((play) => play.id))
    const pages = layoutQuickPages(ordered)
    expect(pages).toHaveLength(2)
    expect(pages[0].blocks).toHaveLength(1)
    expect(pages[0].blocks[0].tiles).toHaveLength(12)
    expect(pages[0].blocks[0].tiles[0].number).toBe(1)
    expect(pages[0].blocks[0].tiles[11].number).toBe(12)
    expect(pages[1].blocks[0].category).toBe('Pass play')
    expect(pages[1].blocks[0].tiles.map((tile) => tile.number)).toEqual([13])
  })

  it('keeps a category header with its tiles and starts a new page when the grid is full', () => {
    const pass = Array.from({ length: 12 }, (_, index) => entry(`p${index}`, 'Pass play'))
    const run = [entry('r', 'Run play', 'Power')]
    const pages = layoutQuickPages(numberedPlays([...run, ...pass], [...pass, ...run].map((play) => play.id)))
    expect(pages[0].blocks.map((block) => block.category)).toEqual(['Pass play'])
    expect(pages[1].blocks[0].category).toBe('Run play')
    expect(pages[1].blocks[0].tiles[0].name).toBe('Power')
  })
})

describe('playbook notes', () => {
  const widthOf = (line: string) => line.length

  it('wraps long notes and leaves blank lines when there are none', () => {
    const wrapped = wrapToWidth('one two three four', widthOf, 7)
    expect(wrapped.length).toBeGreaterThan(1)
    for (const line of wrapped) expect(widthOf(line)).toBeLessThanOrEqual(7)
    expect(noteRows('', widthOf, 20)).toHaveLength(BLANK_NOTE_LINES)
    expect(noteRows('   ', widthOf, 20).every((row) => row.kind === 'blank')).toBe(true)
    const written = noteRows('Block the end and run to the flag', widthOf, 12)
    expect(written.every((row) => row.kind === 'text')).toBe(true)
    expect(written.map((row) => row.text).join(' ')).toContain('flag')
  })
})
