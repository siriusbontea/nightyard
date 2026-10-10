import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { COLOR_ART, LINE_ART, artContentCenter } from './endZoneArt'
import { END_ZONE_COLOR, END_ZONE_LINE } from './endZoneArt'
import { buildPlaybookPdf, coverDate, coverPlacement, logoAsset } from './playbookPdf'

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