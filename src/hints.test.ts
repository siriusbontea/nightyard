import { describe, expect, it } from 'vitest'
import { COLOR_ART, LINE_ART, artContentCenter, placeEndZoneLogo } from './endZoneArt'
import { fieldHint, tip } from './hints'

describe('field hints', () => {
  const base = { tool: 'move' as const, pathsOpen: false, redraw: false, defense: false, guest: false, selected: false }

  it('names the next tap for move, draw, and paths', () => {
    expect(fieldHint(base)).toBe('Drag a player to move. Tap a player to change them.')
    expect(fieldHint({ ...base, tool: 'draw' })).toBe('Pick a player, then draw with your finger.')
    expect(fieldHint({ ...base, pathsOpen: true })).toBe('Pick a player, then pick a path.')
  })

  it('uses defender words on defense and account words for a guest', () => {
    expect(fieldHint({ ...base, defense: true })).toBe('Drag a defender to move. Tap one to change them.')
    expect(fieldHint({ ...base, defense: true, tool: 'draw' })).toBe('Pick a defender, then draw a job.')
    expect(fieldHint({ ...base, defense: true, pathsOpen: true })).toBe('Pick a defender, then pick a job.')
    expect(fieldHint({ ...base, guest: true })).toBe('Drag a player to move. Make an account to save.')
    expect(fieldHint({ ...base, guest: true, tool: 'draw' })).toBe('Draw a path. Make an account to save.')
    expect(fieldHint({ ...base, redraw: true, guest: true })).toBe('Draw a new path from here.')
  })

  it('keeps button tips to eight words', () => {
    for (const text of [
      'Your account',
      'Undo the last change',
      'Open your plays',
      'Pick a ready path',
      'Watch the play',
      'Pick plays for a PDF',
      'Pick every play here',
      'Add this play',
      'Take this play off',
      'White pages for printing',
      'Save the playbook',
      'Name your playbook',
      'Find a play',
      'Play choices',
      'Show or hide these',
      'Switch playbook',
      'Make a new playbook',
      'Rename this playbook',
      'Copy this playbook',
      'Delete this playbook',
      'Copy to another playbook',
      'Move to another playbook',
      'Download this playbook',
      'Load a playbook file',
      'Keep one playbook',
    ]) {
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(8)
      expect(tip(text)['aria-label']).toBe(text)
    }
  })
})

describe('end zone logo', () => {
  it('puts the visible dog on the midpoint of each end zone', () => {
    for (const box of [COLOR_ART, LINE_ART]) {
      const placed = placeEndZoneLogo(40, 100, 530, box)
      const content = artContentCenter(box)
      expect(placed.centerX).toBeCloseTo(265)
      expect(placed.centerY).toBeCloseTo(90)
      expect(placed.x + content.x * placed.width).toBeCloseTo(placed.centerX)
      expect(placed.y + content.y * placed.height).toBeCloseTo(placed.centerY)
      expect(content.y).toBeLessThan(0.48)
    }
  })
})
