import { describe, expect, it } from 'vitest'
import { fieldMarkup, labelFontSize, labelInk } from './fieldMarkup'
import { OUR_COLOR, THEIR_COLOR, defenseFor } from './formations'
import { EXPORT_CAMERA, PLAYER_R } from './geometry'
import { createPlay, setOurSide, setShowDefense, showcasePlay } from './play'
import { NIGHT, PRINT } from './theme'

function labelTag(svg: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = svg.match(new RegExp(`<text[^>]*>${escaped}</text>`))
  expect(match, label).not.toBeNull()
  return match?.[0] ?? ''
}

function fontSize(tag: string): number {
  return Number(/font-size="([\d.]+)"/.exec(tag)?.[1])
}

describe('player markers', () => {
  it('draws the position inside the icon instead of under it', () => {
    const svg = fieldMarkup({ play: showcasePlay(), camera: EXPORT_CAMERA, theme: NIGHT })
    const radius = PLAYER_R * EXPORT_CAMERA.scale
    for (const label of ['X', 'Y', 'Z', 'C', 'QB']) {
      const tag = labelTag(svg, label)
      expect(tag).toContain('x="0"')
      expect(tag).toContain('y="0"')
      expect(tag).toContain('text-anchor="middle"')
      expect(tag).toContain('dominant-baseline="central"')
      expect(fontSize(tag)).toBeLessThan(radius * 1.4)
      expect(fontSize(tag)).toBeGreaterThan(radius * 0.7)
    }
  })

  it('keeps two- and three-character labels inside every formation marker', () => {
    const play = setShowDefense(createPlay({ format: '11v11', formationId: 'i-form' }), true)
    const svg = fieldMarkup({ play, camera: EXPORT_CAMERA, theme: NIGHT })
    const radius = PLAYER_R * EXPORT_CAMERA.scale
    for (const player of play.players) {
      const tag = labelTag(svg, player.label)
      expect(tag, player.label).toContain('y="0"')
      const size = fontSize(tag)
      const widthBudget = radius * 2 * (player.shape === 'diamond' ? 0.7 : 0.68)
      expect(size * Math.max(1, player.label.length) * 0.58, player.label).toBeLessThanOrEqual(widthBudget + 0.6)
    }
    const renamed = createPlay({ format: '5v5', formationId: 'doubles' })
    const slot = renamed.players.find((player) => player.label === 'Y')!
    slot.label = 'SLT'
    const sized = fieldMarkup({ play: renamed, camera: EXPORT_CAMERA, theme: NIGHT })
    expect(fontSize(labelTag(sized, 'SLT'))).toBeLessThan(fontSize(labelTag(sized, 'X')))
  })

  it('picks ink that contrasts with offense, defense, and print fills', () => {
    expect(labelInk('#f0c14a')).toBe('#102033')
    expect(labelInk('#fb7185')).toBe('#102033')
    expect(labelInk('#38bdf8')).toBe('#102033')
    expect(labelInk('#d5dde8')).toBe('#102033')
    expect(labelInk('#e7eef8')).toBe('#102033')
    expect(labelInk('#ffffff')).toBe('#102033')
    expect(labelInk('#d6f25a')).toBe('#102033')
    expect(labelInk('#0b1220')).toBe('#f8fafc')

    const night = fieldMarkup({ play: showcasePlay(), camera: EXPORT_CAMERA, theme: NIGHT })
    expect(labelTag(night, 'QB')).toContain('fill="#102033"')
    const defense = setShowDefense(createPlay({ format: '5v5', formationId: 'doubles' }), true)
    const shell = fieldMarkup({ play: defense, camera: EXPORT_CAMERA, theme: NIGHT })
    const corner = defenseFor('5v5').find((player) => player.label === 'LC')!
    expect(labelTag(shell, 'LC')).toContain(`fill="${labelInk(corner.color)}"`)
    const printed = fieldMarkup({ play: showcasePlay(), camera: EXPORT_CAMERA, theme: PRINT })
    expect(labelTag(printed, 'C')).toContain('fill="#102033"')
  })

  it('sizes a single letter larger than a three-letter label in the same circle', () => {
    const radius = 16
    expect(labelFontSize('X', radius, 'circle')).toBeGreaterThan(labelFontSize('SLT', radius, 'circle'))
    expect(labelFontSize('QB', radius, 'diamond')).toBeLessThan(radius * 1.2)
  })

  it('numbers a midfield snap up to the 50 and back down, and hides both end zones', () => {
    const svg = fieldMarkup({ play: showcasePlay(), camera: EXPORT_CAMERA, theme: NIGHT })
    expect(svg.match(/>50</g)).toHaveLength(2)
    expect(svg.match(/>40</g)).toHaveLength(4)
    expect(svg.match(/>30</g)).toHaveLength(2)
    expect(svg).toContain('data-arrow="up"')
    expect(svg).toContain('data-arrow="down"')
    expect(svg).not.toContain(NIGHT.endZone)
    expect(svg).toContain(`fill="${OUR_COLOR}"`)
    const close = createPlay({ format: '5v5', formationId: 'doubles' })
    close.los = 10
    const redZone = fieldMarkup({ play: close, camera: EXPORT_CAMERA, theme: NIGHT })
    expect(redZone).toContain(NIGHT.endZone)
    expect(redZone).not.toContain('data-arrow="down"')
  })

  it('uses team colors on a defense play and keeps path colors different', () => {
    const play = setShowDefense(setOurSide(createPlay({ format: '5v5', formationId: 'doubles' }), 'defense'), true)
    const svg = fieldMarkup({ play, camera: EXPORT_CAMERA, theme: NIGHT })
    expect(svg).toContain(`fill="${OUR_COLOR}"`)
    expect(svg).toContain(`fill="${THEIR_COLOR}"`)
    const routes = new Set(play.players.map((player) => player.routeColor))
    expect(routes.size).toBeGreaterThan(3)
    for (const color of routes) expect(color).not.toBe(OUR_COLOR)
    const printed = fieldMarkup({ play, camera: EXPORT_CAMERA, theme: PRINT })
    expect(printed).toContain('>40<')
    expect(printed).toContain('fill="#ffffff"')
  })
})
