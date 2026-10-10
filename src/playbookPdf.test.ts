import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { COLOR_ART, LINE_ART, artContentCenter } from './endZoneArt'
import { END_ZONE_COLOR, END_ZONE_LINE } from './endZoneArt'
import { buildPlaybookDocument, buildPlaybookPdf, coverDate, coverPlacement, logoAsset, renderDiagramSvg } from './playbookPdf'
import { createPlay } from './play'

function tinyPng(): Uint8Array {
  const bin = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const TINY_PNG = tinyPng()

describe('playbook pdf cover', () => {
  it('uses the color dog for color and the line dog for white', () => {
    expect(logoAsset('color')).toBe(END_ZONE_COLOR)
    expect(logoAsset('print')).toBe(END_ZONE_LINE)
    expect(coverDate(new Date(2026, 9, 10))).toBe('October 10, 2026')
  })

  it('centers the visible dog above the title', () => {
    for (const box of [COLOR_ART, LINE_ART]) {
      const place = coverPlacement(box)
      const content = artContentCenter(box)
      expect(place.x + content.x * place.width).toBeCloseTo(place.visibleCenterX)
      expect(place.y + place.height * (1 - content.y)).toBeCloseTo(place.visibleCenterY)
      expect(place.visibleCenterX).toBeCloseTo(306)
      expect(place.titleY).toBeLessThan(place.visibleCenterY - 80)
      expect(place.dateY).toBeLessThan(place.titleY)
      expect(place.dateY).toBeGreaterThan(40)
    }
  })

  it('writes the book name and date on the cover, then one page per play', async () => {
    const bytes = await buildPlaybookPdf({
      name: 'Friday Night',
      dateLabel: 'October 10, 2026',
      style: 'print',
      logoPng: TINY_PNG,
      art: LINE_ART,
      pages: [TINY_PNG],
    })
    expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-')
    expect(new TextDecoder('latin1').decode(bytes).match(/\/Subtype \/Image/g)?.length).toBeGreaterThanOrEqual(2)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getTitle()).toBe('Friday Night')
    expect(doc.getSubject()).toBe('October 10, 2026')
  })
})

describe('playbook document', () => {
  const play = {
    number: 1,
    name: 'Stick',
    formation: 'Trips',
    formatLabel: '11v11 tackle',
    category: 'Pass play',
    notes: '',
    diagram: TINY_PNG,
  }

  it('builds a cover, a quick view, and one full page per play', async () => {
    const bytes = await buildPlaybookDocument({
      title: 'Dawgs Playbook',
      dateLabel: 'October 10, 2026',
      style: 'color',
      logoPng: TINY_PNG,
      art: COLOR_ART,
      plays: [play, { ...play, number: 2, name: 'Power', category: 'Run play', notes: 'Block the end and bounce outside.' }],
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(4)
    expect(doc.getTitle()).toBe('Dawgs Playbook')
    expect(doc.getSubject()).toBe('October 10, 2026')
    expect(new TextDecoder('latin1').decode(bytes).match(/\/Subtype \/Image/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('gives a long book a second quick-view page', async () => {
    const plays = Array.from({ length: 13 }, (_, index) => ({
      ...play,
      number: index + 1,
      name: `Pass ${index + 1}`,
    }))
    const bytes = await buildPlaybookDocument({
      title: 'Dawgs Playbook',
      dateLabel: 'October 10, 2026',
      style: 'print',
      logoPng: TINY_PNG,
      art: LINE_ART,
      plays,
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1 + 2 + 13)
  })

  it('draws a high-res field, dotted on white and in color on the color book', () => {
    const sample = createPlay({ format: '11v11', name: 'Stick' })
    const print = renderDiagramSvg(sample, 'print')
    const color = renderDiagramSvg(sample, 'color')
    const width = Number(print.match(/width="([0-9.]+)"/)?.[1])
    expect(width).toBeGreaterThanOrEqual(1400)
    expect(print).toContain('stroke-dasharray')
    expect(print).not.toContain('end-zone.webp')
    expect(color).not.toContain('stroke-dasharray="0.01')
    expect(color).toContain('end-zone')
  })
})