import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { COLOR_ART, LINE_ART, artContentCenter } from './endZoneArt'
import { END_ZONE_LINE } from './endZoneArt'
import {
  buildPlaybookDocument,
  buildPlaybookPdf,
  coverDate,
  coverMode,
  coverPlacement,
  loadCoverArt,
  logoAsset,
  originalCoverLayout,
  renderDiagramSvg,
} from './playbookPdf'
import { createPlay } from './play'

function tinyPng(): Uint8Array {
  const bin = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const TINY_PNG = tinyPng()

function tinyJpeg(): Uint8Array {
  const bin = atob(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDlqKKKAP/Z',
  )
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

describe('playbook pdf cover', () => {
  it('uses the original art on a color cover and the line dog on white', () => {
    expect(coverMode('color')).toBe('original')
    expect(coverMode('print')).toBe('line')
    expect(logoAsset('color')).toBeNull()
    expect(logoAsset('print')).toBe(END_ZONE_LINE)
    expect(coverDate(new Date(2026, 9, 10))).toBe('October 10, 2026')
  })

  it('centers the original art at about six inches, with the title underneath', () => {
    const place = originalCoverLayout(1187, 1213)
    expect(place.width).toBeCloseTo(432)
    expect(place.x).toBeCloseTo((612 - place.width) / 2)
    expect(place.y).toBeGreaterThan(place.titleY)
    expect(place.titleY).toBeGreaterThan(place.dateY)
    expect(place.dateY).toBeGreaterThan(40)
    expect(place.y + place.height).toBeLessThan(792)
  })

  it('loads the original jpeg only for a color cover', async () => {
    const color = await loadCoverArt('color')
    expect(color.kind).toBe('jpeg')
    expect(color.mode).toBe('original')
    expect(color.bytes[0]).toBe(0xff)
    expect(color.bytes[1]).toBe(0xd8)
    expect(color.bytes.byteLength).toBeGreaterThan(30_000)
    expect(color.bytes.byteLength).toBeLessThan(400_000)
    const print = await loadCoverArt('print')
    expect(print.kind).toBe('png')
    expect(print.mode).toBe('line')
    expect(print.bytes).not.toEqual(color.bytes)
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
      logoBytes: tinyJpeg(),
      logoKind: 'jpeg',
      coverMode: 'original',
      art: COLOR_ART,
      plays: [play, { ...play, number: 2, name: 'Power', category: 'Run play', notes: 'Block the end and bounce outside.' }],
    })
    expect(new TextDecoder('latin1').decode(bytes)).toContain('/DCTDecode')
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
      logoBytes: TINY_PNG,
      logoKind: 'png',
      coverMode: 'line',
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