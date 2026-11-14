import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { categoryOf, isPlayCategory, type PlayCategory } from './categories'
import { END_ZONE_COLOR, END_ZONE_LINE, LINE_ART, artContentCenter, type OpaqueBox } from './endZoneArt'
import { fieldMarkup } from './fieldMarkup'
import { viewSize } from './geometry'
import { layoutQuickPages, noteRows, playbookTitle, wrapToWidth } from './playbookLayout'
import { renderPng } from './pngExport'
import { COLOR_FIELD, PRINT } from './theme'
import type { ExportStyle } from './exportSvg'
import type { Play } from './types'
import { formatLabel } from './types'

export const LETTER_W = 612
export const LETTER_H = 792

/** White covers keep the line-art dog. Color covers use the original file, loaded on demand. */
export function logoAsset(style: ExportStyle): string | null {
  return style === 'print' ? END_ZONE_LINE : null
}

export function coverMode(style: ExportStyle): 'original' | 'line' {
  return style === 'print' ? 'line' : 'original'
}

/** Six inches on a letter page. The file is about 200 pixels per inch at this size. */
export const COVER_ART_WIDTH = 6 * 72

/** Matches the compressed edge of the original art so the square disappears. */
export const COVER_BG = '#191919'

export function originalCoverLayout(pixelW: number, pixelH: number): {
  x: number
  y: number
  width: number
  height: number
  titleY: number
  dateY: number
} {
  let width = COVER_ART_WIDTH
  let height = width * (pixelH / Math.max(pixelW, 1))
  const titleY = 156
  const dateY = 122
  const y = titleY + 56
  const maxTop = LETTER_H - 28
  if (y + height > maxTop) {
    height = maxTop - y
    width = height * (pixelW / Math.max(pixelH, 1))
  }
  return { x: (LETTER_W - width) / 2, y, width, height, titleY, dateY }
}

/** Vitest serves asset imports as root paths. Node fetch cannot load those, so tests read the file. */
async function fetchBytes(url: string): Promise<Uint8Array> {
  if (import.meta.env.MODE === 'test' && !/^https?:/i.test(url)) {
    const fsName = 'node:fs/promises'
    const urlName = 'node:url'
    const fs = (await import(/* @vite-ignore */ fsName)) as {
      readFile: (path: string) => Promise<Uint8Array>
    }
    const urlMod = (await import(/* @vite-ignore */ urlName)) as {
      fileURLToPath: (input: string | URL) => string
    }
    const file = url.startsWith('file:')
      ? urlMod.fileURLToPath(url)
      : urlMod.fileURLToPath(new URL(url.startsWith('/') ? `..${url}` : url, import.meta.url))
    return new Uint8Array(await fs.readFile(file))
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not load the team logo.')
  return new Uint8Array(await response.arrayBuffer())
}

/** The original jpeg is a separate file. It is fetched only while a color PDF is built. */
export async function loadCoverArt(style: ExportStyle): Promise<{
  bytes: Uint8Array
  kind: 'jpeg' | 'png'
  mode: 'original' | 'line'
}> {
  const mode = coverMode(style)
  if (mode === 'line') return { bytes: await fetchBytes(END_ZONE_LINE), kind: 'png', mode }
  const mod = await import('./assets/cover-dawgs.jpg')
  return { bytes: await fetchBytes(mod.default), kind: 'jpeg', mode }
}

export function coverDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/** Where the dog, the title, and the date sit on a letter cover. PDF y grows upward. */
export function coverPlacement(box: OpaqueBox): {
  x: number
  y: number
  width: number
  height: number
  visibleCenterX: number
  visibleCenterY: number
  titleY: number
  dateY: number
} {
  const content = artContentCenter(box)
  const span = (box.bottom - box.top) / box.height
  const visibleH = 280
  const height = visibleH / span
  const width = height * (box.width / box.height)
  const visibleCenterX = LETTER_W / 2
  const visibleCenterY = 500
  const x = visibleCenterX - content.x * width
  const y = visibleCenterY - height * (1 - content.y)
  const visibleBottom = y + height * (1 - box.bottom / box.height)
  return {
    x,
    y,
    width,
    height,
    visibleCenterX,
    visibleCenterY,
    titleY: visibleBottom - 48,
    dateY: visibleBottom - 80,
  }
}

function pdfSafe(value: string, fallback: string): string {
  const text = value.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim()
  return text || fallback
}

function fill(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function drawCentered(page: PDFPage, text: string, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (LETTER_W - width) / 2, y, size, font, color })
}

export async function buildPlaybookPdf(input: {
  name: string
  dateLabel: string
  style: ExportStyle
  logoPng?: Uint8Array
  logoBytes?: Uint8Array
  logoKind?: 'jpeg' | 'png'
  coverMode?: 'original' | 'line'
  art: OpaqueBox
  pages: Uint8Array[]
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const title = pdfSafe(input.name, 'Night Yard')
  const dateLabel = pdfSafe(input.dateLabel, '')
  doc.setTitle(title)
  doc.setSubject(dateLabel)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  await paintCover(doc, {
    title,
    dateLabel,
    style: input.style,
    logoBytes: input.logoBytes ?? input.logoPng ?? new Uint8Array(),
    logoKind: input.logoKind ?? 'png',
    coverMode: input.coverMode ?? coverMode(input.style),
    art: input.art,
    pageNumber: 1,
  }, font, bold)

  for (const bytes of input.pages) {
    const page = doc.addPage([LETTER_W, LETTER_H])
    const image = await doc.embedPng(bytes)
    page.drawImage(image, { x: 0, y: 0, width: LETTER_W, height: LETTER_H })
  }
  return doc.save()
}

/** Letter playbook. Color covers use the original art. White covers keep the line dog. */
export async function renderPlaybookPdf(input: {
  name: string
  plays: Play[]
  style: ExportStyle
  date: Date
  includeNotes: boolean
  includeAssignments: boolean
}): Promise<Uint8Array> {
  const cover = await loadCoverArt(input.style)
  const pages: Uint8Array[] = []
  for (const play of input.plays) {
    const blob = await renderPng(play, input.style, {
      includeNotes: input.includeNotes,
      includeAssignments: input.includeAssignments,
    })
    pages.push(new Uint8Array(await blob.arrayBuffer()))
  }
  return buildPlaybookPdf({
    name: input.name,
    dateLabel: coverDate(input.date),
    style: input.style,
    logoBytes: cover.bytes,
    logoKind: cover.kind,
    coverMode: cover.mode,
    art: LINE_ART,
    pages,
  })
}

/** Field-only diagram. Scale is high enough to stay sharp on a letter page. */
export const DIAGRAM_SCALE = 28

export function renderDiagramSvg(play: Play, style: ExportStyle, displayPx?: number): string {
  const theme = style === 'print' ? PRINT : COLOR_FIELD
  const camera = { ahead: 30, behind: 16, scale: DIAGRAM_SCALE }
  const size = viewSize(camera)
  const shown = displayPx && displayPx > 40 ? displayPx : size.w
  const body = fieldMarkup({ play, camera, theme, showHandles: false, pxPerUnit: shown / size.w })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.w.toFixed(0)}" height="${size.h.toFixed(0)}" viewBox="0 0 ${size.w} ${size.h}">${body}</svg>`
}

export interface PlaybookPagePlay {
  number: number
  name: string
  formation: string
  formatLabel: string
  category: string
  notes: string
  diagram: Uint8Array
}

const MARGIN = 36
const TILE_GAP = 8
const TILE_LABEL = 13
const TILE_DIAGRAM = 132
const TILE_ROW = TILE_LABEL + 4 + TILE_DIAGRAM + 8

function asCategory(value: string): PlayCategory {
  return isPlayCategory(value) ? value : 'Other'
}

function fitLine(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = pdfSafe(text, '')
  if (!clean) return ''
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean
  let next = clean
  while (next.length > 1 && font.widthOfTextAtSize(`${next}...`, size) > maxWidth) next = next.slice(0, -1)
  return `${next}...`
}

function footer(page: PDFPage, font: PDFFont, pageNumber: number, color: ReturnType<typeof rgb>) {
  const label = String(pageNumber)
  const size = 10
  const width = font.widthOfTextAtSize(label, size)
  page.drawText(label, { x: (LETTER_W - width) / 2, y: 18, size, font, color })
}

function contain(boxW: number, boxH: number, imgW: number, imgH: number) {
  const scale = Math.min(boxW / imgW, boxH / imgH)
  const width = imgW * scale
  const height = imgH * scale
  return { width, height, ox: (boxW - width) / 2, oy: (boxH - height) / 2 }
}

/** Cover, quick-view grid, then one full page per play. Page numbers sit in the footer. */
export async function buildPlaybookDocument(input: {
  title: string
  dateLabel: string
  style: ExportStyle
  logoBytes: Uint8Array
  logoKind: 'jpeg' | 'png'
  coverMode: 'original' | 'line'
  art: OpaqueBox
  plays: PlaybookPagePlay[]
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const title = pdfSafe(playbookTitle(input.title), 'Dawgs Playbook')
  const dateLabel = pdfSafe(input.dateLabel, '')
  doc.setTitle(title)
  doc.setSubject(dateLabel)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const theme = input.style === 'print' ? PRINT : COLOR_FIELD
  const ink = fill(theme.title)
  const muted = fill(theme.muted)
  const paper = fill(theme.page)
  const diagrams = new Map<number, PDFImage>()
  for (const play of input.plays) diagrams.set(play.number, await doc.embedPng(play.diagram))

  const quick = layoutQuickPages(
    input.plays.map((play) => ({
      id: String(play.number),
      name: play.name,
      category: asCategory(play.category),
      number: play.number,
    })),
  )
  let pageNumber = 1
  await paintCover(
    doc,
    {
      title,
      dateLabel,
      style: input.style,
      logoBytes: input.logoBytes,
      logoKind: input.logoKind,
      coverMode: input.coverMode,
      art: input.art,
      pageNumber,
    },
    font,
    bold,
  )
  pageNumber += 1

  const tileW = (LETTER_W - MARGIN * 2 - TILE_GAP * 2) / 3
  for (const quickPage of quick) {
    const page = doc.addPage([LETTER_W, LETTER_H])
    page.drawRectangle({ x: 0, y: 0, width: LETTER_W, height: LETTER_H, color: paper })
    let cursor = LETTER_H - 42
    page.drawText('Quick view', { x: MARGIN, y: cursor, size: 14, font: bold, color: ink })
    cursor -= 24
    for (const block of quickPage.blocks) {
      page.drawText(pdfSafe(block.category, 'Other'), { x: MARGIN, y: cursor, size: 12, font: bold, color: ink })
      cursor -= 16
      for (let index = 0; index < block.tiles.length; index += 3) {
        const row = block.tiles.slice(index, index + 3)
        row.forEach((tile, column) => {
          const x = MARGIN + column * (tileW + TILE_GAP)
          const label = fitLine(`${tile.number}  ${tile.name}`, bold, 9, tileW)
          page.drawText(label, { x, y: cursor, size: 9, font: bold, color: ink })
          const image = diagrams.get(tile.number)
          if (!image) return
          const fit = contain(tileW, TILE_DIAGRAM, image.width, image.height)
          const ix = x + fit.ox
          const iy = cursor - TILE_LABEL - TILE_DIAGRAM + fit.oy
          page.drawImage(image, { x: ix, y: iy, width: fit.width, height: fit.height })
        })
        cursor -= TILE_ROW
      }
      cursor -= 6
    }
    footer(page, font, pageNumber, muted)
    pageNumber += 1
  }

  for (const play of input.plays) {
    const page = doc.addPage([LETTER_W, LETTER_H])
    page.drawRectangle({ x: 0, y: 0, width: LETTER_W, height: LETTER_H, color: paper })
    const textWidth = LETTER_W - MARGIN * 2
    let cursor = LETTER_H - 46
    const heading = wrapToWidth(pdfSafe(`${play.number}  ${play.name}`, 'Play'), (line) => bold.widthOfTextAtSize(line, 20), textWidth).slice(0, 2)
    for (const line of heading) {
      page.drawText(line, { x: MARGIN, y: cursor, size: 20, font: bold, color: ink })
      cursor -= 24
    }
    const meta = pdfSafe(`${play.formation} - ${play.formatLabel} - ${play.category}`, '')
    page.drawText(fitLine(meta, font, 11, textWidth), { x: MARGIN, y: cursor, size: 11, font, color: muted })
    cursor -= 16

    const rows = noteRows(play.notes, (line) => font.widthOfTextAtSize(line, 11), textWidth).slice(0, 12)
    const notesHeight = 20 + rows.length * 16
    const diagramTop = cursor - 4
    const diagramBottom = 34 + notesHeight
    const availH = Math.max(180, diagramTop - diagramBottom)
    const image = diagrams.get(play.number)
    if (image) {
      const fit = contain(textWidth, availH, image.width, image.height)
      const ix = MARGIN + (textWidth - fit.width) / 2
      const iy = diagramBottom + (availH - fit.height) / 2
      page.drawImage(image, { x: ix, y: iy, width: fit.width, height: fit.height })
    }
    let noteY = diagramBottom - 8
    page.drawText('Notes', { x: MARGIN, y: noteY, size: 12, font: bold, color: ink })
    noteY -= 16
    for (const row of rows) {
      if (row.kind === 'blank') {
        page.drawLine({
          start: { x: MARGIN, y: noteY },
          end: { x: LETTER_W - MARGIN, y: noteY },
          thickness: 0.6,
          color: muted,
          opacity: 0.55,
        })
      } else if (row.text) {
        page.drawText(pdfSafe(row.text, ''), { x: MARGIN, y: noteY, size: 11, font, color: ink })
      }
      noteY -= 16
    }
    footer(page, font, pageNumber, muted)
    pageNumber += 1
  }

  return doc.save()
}

async function svgToPng(svg: string): Promise<Uint8Array> {
  let next = svg
  for (const url of [END_ZONE_COLOR, END_ZONE_LINE]) {
    if (!next.includes(url)) continue
    const response = await fetch(url)
    if (!response.ok) throw new Error('Could not load the team logo.')
    const bytes = new Uint8Array(await response.arrayBuffer())
    const mime = url.endsWith('.webp') ? 'image/webp' : 'image/png'
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    next = next.split(url).join(`data:${mime};base64,${btoa(binary)}`)
  }
  const blob = new Blob([next], { type: 'image/svg+xml;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not draw the play.'))
      image.src = objectUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable in this browser.')
    context.drawImage(image, 0, 0)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!png) throw new Error('Could not draw the play.')
    return new Uint8Array(await png.arrayBuffer())
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** Letter playbook from picked plays. Diagrams are high-res pictures of the field. */
export async function renderPlaybookFile(input: {
  title: string
  plays: Play[]
  style: ExportStyle
  date: Date
}): Promise<Uint8Array> {
  const cover = await loadCoverArt(input.style)
  const plays: PlaybookPagePlay[] = []
  for (let index = 0; index < input.plays.length; index += 1) {
    const play = input.plays[index]
    plays.push({
      number: index + 1,
      name: play.name,
      formation: play.formation,
      formatLabel: formatLabel(play.format),
      category: categoryOf(play),
      notes: play.notes,
      diagram: await svgToPng(renderDiagramSvg(play, input.style, 360)),
    })
  }
  return buildPlaybookDocument({
    title: input.title,
    dateLabel: coverDate(input.date),
    style: input.style,
    logoBytes: cover.bytes,
    logoKind: cover.kind,
    coverMode: cover.mode,
    art: LINE_ART,
    plays,
  })
}

async function paintCover(
  doc: PDFDocument,
  input: {
    title: string
    dateLabel: string
    style: ExportStyle
    logoBytes: Uint8Array
    logoKind: 'jpeg' | 'png'
    coverMode: 'original' | 'line'
    art: OpaqueBox
    pageNumber: number
  },
  font: PDFFont,
  bold: PDFFont,
) {
  const original = input.coverMode === 'original'
  const theme = input.style === 'print' ? PRINT : COLOR_FIELD
  const paper = fill(original ? COVER_BG : theme.page)
  const titleColor = fill(original ? '#FFFFFF' : theme.title)
  const dateColor = fill(original ? '#F9682D' : theme.muted)
  const foot = fill(original ? '#B5B5B5' : theme.muted)
  const logo = input.logoKind === 'jpeg' ? await doc.embedJpg(input.logoBytes) : await doc.embedPng(input.logoBytes)
  const place = original ? originalCoverLayout(logo.width, logo.height) : coverPlacement(input.art)
  const cover = doc.addPage([LETTER_W, LETTER_H])
  cover.drawRectangle({ x: 0, y: 0, width: LETTER_W, height: LETTER_H, color: paper })
  cover.drawImage(logo, { x: place.x, y: place.y, width: place.width, height: place.height })
  let titleSize = original ? 26 : 36
  while (titleSize > 16 && bold.widthOfTextAtSize(input.title, titleSize) > 480) titleSize -= 2
  drawCentered(cover, input.title, place.titleY, titleSize, bold, titleColor)
  drawCentered(cover, input.dateLabel, place.dateY, original ? 14 : 16, font, dateColor)
  footer(cover, font, input.pageNumber, foot)
}
