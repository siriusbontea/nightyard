import { describe, expect, it } from 'vitest'
import { END_ZONE_COLOR, END_ZONE_LINE } from './endZoneArt'
import { fieldMarkup, labelFontSize, labelInk } from './fieldMarkup'
import { fieldYAt } from './fieldMarks'
import { OUR_COLOR, ROUTE_PALETTE, THEIR_COLOR, defenseFor } from './formations'
import { EXPORT_CAMERA, FIELD_WIDTH, PLAYER_R, cameraForBox, fieldToSvg, viewSize } from './geometry'
import { createPlay, setOurSide, setShowDefense, showcasePlay } from './play'
import { LOS_BLUE, NIGHT, PRINT } from './theme'

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

  it('draws a football emoji at the ball, with a laced ball underneath', () => {
    const svg = fieldMarkup({ play: showcasePlay(), camera: EXPORT_CAMERA, theme: NIGHT })
    expect(svg).toContain('🏈')
    expect(svg).toContain('class="ball-fallback"')
    expect(svg).toContain('class="ball-emoji"')
    const printed = fieldMarkup({ play: showcasePlay(), camera: EXPORT_CAMERA, theme: PRINT })
    expect(printed).toContain('🏈')
    expect(printed).toContain('class="ball-fallback"')
    expect(printed).toContain('fill="#ffffff"')
  })

  it('draws readable yard numbers on both sidelines, including the 50', () => {
    const width = 360
    const height = 640
    const camera = cameraForBox(width, height, 50)
    const { w, h } = viewSize(camera)
    expect(w / h).toBeCloseTo(width / height, 4)
    const onTheFifty = createPlay({ format: '11v11', formationId: 'shotgun-trips' })
    onTheFifty.los = 50
    const svg = fieldMarkup({ play: onTheFifty, camera, theme: NIGHT })
    const tags = [...svg.matchAll(/<text\b([^>]*)>(\d+)<\/text>/g)]
      .map((match) => ({ attrs: match[1], label: Number(match[2]) }))
      .filter((tag) => /rotate\(/.test(tag.attrs))
    expect(tags.length).toBeGreaterThanOrEqual(8)
    const fifties = tags.filter((tag) => tag.label === 50)
    expect(fifties).toHaveLength(2)
    const left = tags.filter((tag) => /rotate\(-90 /.test(tag.attrs))
    const right = tags.filter((tag) => /rotate\(90 /.test(tag.attrs))
    expect(left.length).toBe(right.length)
    expect(left.length).toBeGreaterThanOrEqual(4)
    for (const tag of tags) {
      const x = Number(/\bx="([\d.]+)"/.exec(tag.attrs)?.[1])
      const y = Number(/\by="([\d.]+)"/.exec(tag.attrs)?.[1])
      const rot = /rotate\((-?[\d.]+) ([\d.]+) ([\d.]+)\)/.exec(tag.attrs)
      expect(rot, tag.attrs).not.toBeNull()
      expect(x).toBeCloseTo(Number(rot?.[2]), 5)
      expect(y).toBeCloseTo(Number(rot?.[3]), 5)
      expect(x).toBeGreaterThan(4 * camera.scale)
      expect(x).toBeLessThan(FIELD_WIDTH * camera.scale - 4 * camera.scale)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(h)
      expect(tag.attrs).toContain(`font-size="${(3.6 * camera.scale).toFixed(1)}"`)
    }
    expect(Math.min(...left.map((tag) => Number(/\bx="([\d.]+)"/.exec(tag.attrs)?.[1])))).toBeLessThan(w / 2)
    expect(Math.max(...right.map((tag) => Number(/\bx="([\d.]+)"/.exec(tag.attrs)?.[1])))).toBeGreaterThan(w / 2)
    const up = svg.match(/data-arrow="up"/g) ?? []
    const down = svg.match(/data-arrow="down"/g) ?? []
    expect(up.length).toBeGreaterThanOrEqual(2)
    expect(down.length).toBeGreaterThanOrEqual(2)
    expect(svg).not.toContain('data-arrow-for="50"')

    const lines = [...svg.matchAll(/<line x1="0" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)]
      .filter((match) => Math.abs(Number(match[2]) - w) < 1)
      .map((match) => Number(match[1]))
      .sort((a, b) => a - b)
    expect(lines.length).toBeGreaterThan(4)
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i] - lines[i - 1]).toBeLessThanOrEqual(5 * camera.scale + 0.2)
    }
    const endZones = [...svg.matchAll(new RegExp(`<rect x="0" y="(-?[\\d.]+)" width="[^"]+" height="([\\d.]+)" fill="${NIGHT.endZone}"`, 'g'))]
    const edgeCovered = (edge: number, line: number) => {
      if (Math.abs(line - edge) <= 5 * camera.scale + 2) return true
      return endZones.some((match) => {
        const y = Number(match[1])
        const heightPx = Number(match[2])
        const from = Math.min(edge, line)
        const to = Math.max(edge, line)
        return y <= from + 1 && y + heightPx >= to - 1
      })
    }
    expect(edgeCovered(0, lines[0])).toBe(true)
    expect(edgeCovered(h, lines[lines.length - 1])).toBe(true)
  })

  it('fills a phone-shaped frame from the top edge to the bottom edge', () => {
    for (const [width, height] of [
      [390, 844],
      [390, 700],
      [430, 932],
    ] as const) {
      const camera = cameraForBox(width, height, 50)
      const { w, h } = viewSize(camera)
      expect(w / h).toBeCloseTo(width / height, 4)
      const losY = camera.ahead * camera.scale
      expect(losY).toBeGreaterThan(h * 0.2)
      expect(losY).toBeLessThan(h * 0.75)
      const onTheFifty = createPlay({ format: '11v11', formationId: 'shotgun-trips' })
      onTheFifty.los = 50
      const svg = fieldMarkup({ play: onTheFifty, camera, theme: NIGHT })
      const lines = [...svg.matchAll(/<line x1="0" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)]
        .filter((match) => Math.abs(Number(match[2]) - w) < 1)
        .map((match) => Number(match[1]))
        .sort((a, b) => a - b)
      const endZones = [...svg.matchAll(new RegExp(`<rect x="0" y="(-?[\\d.]+)" width="[^"]+" height="([\\d.]+)" fill="${NIGHT.endZone}"`, 'g'))]
      const edgeCovered = (edge: number, line: number) => {
        if (Math.abs(line - edge) <= 5 * camera.scale + 2) return true
        return endZones.some((match) => {
          const y = Number(match[1])
          const heightPx = Number(match[2])
          const from = Math.min(edge, line)
          const to = Math.max(edge, line)
          return y <= from + 1 && y + heightPx >= to - 1
        })
      }
      expect(lines.length, `${width}x${height}`).toBeGreaterThan(4)
      expect(edgeCovered(0, lines[0]), `${width}x${height} top`).toBe(true)
      expect(edgeCovered(h, lines[lines.length - 1]), `${width}x${height} bottom`).toBe(true)
    }
  })

  it('frames a phone on the 30 so the formation, a deep route, and the far end zone fit', () => {
    const play = createPlay({ format: '11v11', formationId: 'shotgun-trips' })
    expect(play.los).toBe(30)
    const camera = cameraForBox(372, 560, play.los)
    const { h } = viewSize(camera)
    const svg = fieldMarkup({ play, camera, theme: NIGHT })
    expect(svg).toContain('data-endzone="far"')
    expect(svg).toContain(END_ZONE_COLOR)
    expect(camera.ahead).toBeGreaterThanOrEqual(play.los + 10)
    for (const player of play.players) {
      const at = fieldToSvg(player, camera)
      expect(at.y, player.label).toBeGreaterThan(0)
      expect(at.y, player.label).toBeLessThan(h)
    }
    const routeEnd = fieldToSvg({ x: 0, y: 16 }, camera)
    expect(routeEnd.y).toBeGreaterThan(0)
    expect(routeEnd.y).toBeLessThan(h)
  })

  it('shows the far end zone when the snap is on the 3', () => {
    const play = showcasePlay()
    const camera = cameraForBox(402, 640, play.los)
    const svg = fieldMarkup({ play, camera, theme: NIGHT })
    expect(svg).toContain('data-endzone="far"')
    expect(svg).toContain(END_ZONE_COLOR)
    expect(camera.ahead).toBeGreaterThanOrEqual(play.los + 10)
  })

  it('numbers a midfield snap up to the 50 and back down, and hides both end zones', () => {
    const midfield = createPlay({ format: '11v11', formationId: 'shotgun-trips' })
    midfield.los = 50
    const svg = fieldMarkup({ play: midfield, camera: EXPORT_CAMERA, theme: NIGHT })
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
    expect(redZone).toContain(END_ZONE_COLOR)
    expect(redZone).toContain('data-endzone="far"')
    expect(redZone).not.toContain(END_ZONE_LINE)
    expect(svg).not.toContain(END_ZONE_COLOR)
    const printedZone = fieldMarkup({ play: close, camera: EXPORT_CAMERA, theme: PRINT })
    expect(printedZone).toContain(END_ZONE_LINE)
    expect(printedZone).not.toContain(END_ZONE_COLOR)
    expect(redZone).not.toContain('data-arrow="down"')
  })

  it('paints both end zones under the lines, each facing the field', () => {
    const play = createPlay({ format: '5v5', formationId: 'doubles' })
    play.los = 10
    const svg = fieldMarkup({ play, camera: { ahead: 20, behind: 110, scale: 10 }, theme: NIGHT })
    const far = svg.indexOf('data-endzone="far"')
    const near = svg.indexOf('data-endzone="near"')
    const line = svg.indexOf('<line ')
    expect(far).toBeGreaterThan(-1)
    expect(near).toBeGreaterThan(-1)
    expect(svg.slice(near, near + 180)).toContain('rotate(180')
    expect(svg.slice(far, far + 80)).not.toContain('rotate(180')
    expect(far).toBeLessThan(line)
    expect(near).toBeLessThan(line)
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

  it('puts the line of scrimmage on the snap yard line, sideline to sideline', () => {
    expect(ROUTE_PALETTE).not.toContain(LOS_BLUE)
    expect(LOS_BLUE.toLowerCase()).not.toBe(OUR_COLOR)
    expect(LOS_BLUE.toLowerCase()).not.toBe(THEIR_COLOR)
    for (const los of [50, 5]) {
      for (const camera of [cameraForBox(402, 874, los), cameraForBox(1280, 800, los), EXPORT_CAMERA]) {
        const play = createPlay({ format: '11v11' })
        play.los = los
        const { w } = viewSize(camera)
        const y = (camera.ahead * camera.scale - fieldYAt(los, los) * camera.scale).toFixed(2)
        const svg = fieldMarkup({ play, camera, theme: NIGHT })
        const line = svg.match(/<line [^>]*data-los="line"[^>]*>/)?.[0] ?? ''
        expect(line, `${los} ${camera.ahead}`).toContain(`y1="${y}"`)
        expect(line).toContain(`y2="${y}"`)
        expect(line).toContain('x1="0"')
        expect(line).toContain(`x2="${w}"`)
        expect(line).toContain(`stroke="${LOS_BLUE}"`)
        expect(line).not.toContain('filter=')
        expect(line).not.toContain('stroke-dasharray')
        expect(svg).toContain(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${NIGHT.line}"`)
        expect(svg).not.toContain('feGaussianBlur')
      }
    }
    const printed = fieldMarkup({ play: showcasePlay(), camera: EXPORT_CAMERA, theme: PRINT })
    const dotted = printed.match(/<line [^>]*data-los="line"[^>]*>/)?.[0] ?? ''
    expect(dotted).toContain('stroke="#111111"')
    expect(dotted).toContain('stroke-dasharray="0.01 9"')
    expect(dotted).toContain('stroke-linecap="round"')
    expect(dotted).not.toContain(LOS_BLUE)
    const chip = printed.match(/<g data-los="chip"[^>]*>[\s\S]*?<\/g>/)?.[0] ?? ''
    expect(chip).toContain('fill="#ffffff"')
    expect(chip).toContain('stroke="#111111"')
    expect(chip).toContain('fill="#111111"')
    expect(chip).toContain('>LINE<')
    expect(chip).not.toContain(LOS_BLUE)
  })

  it('keeps the LINE chip small and off the players', () => {
    const play = setShowDefense(createPlay({ format: '11v11' }), true)
    play.los = 50
    const camera = cameraForBox(402, 874, 50)
    const svg = fieldMarkup({ play, camera, theme: NIGHT })
    const chip = svg.match(
      /<g data-los="chip"[^>]*transform="translate\(([\d.]+) ([\d.]+)\)"><rect width="([\d.]+)" height="([\d.]+)"/,
    )
    expect(chip).not.toBeNull()
    const x = Number(chip?.[1])
    const y = Number(chip?.[2])
    const width = Number(chip?.[3])
    const height = Number(chip?.[4])
    expect(width).toBeLessThan(42)
    expect(height).toBeLessThan(18)
    expect(x).toBeLessThan(4 * camera.scale)
    expect(x + width).toBeLessThan(4 * camera.scale)
    for (const player of play.players) {
      const at = fieldToSvg(player, camera)
      const nearestX = Math.max(x, Math.min(at.x, x + width))
      const nearestY = Math.max(y, Math.min(at.y, y + height))
      const gap = Math.hypot(at.x - nearestX, at.y - nearestY)
      expect(gap, player.label).toBeGreaterThan(PLAYER_R * camera.scale)
    }
  })
})
