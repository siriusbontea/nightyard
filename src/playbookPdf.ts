import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { COLOR_ART, END_ZONE_COLOR, END_ZONE_LINE, LINE_ART, artContentCenter, type OpaqueBox } from './endZoneArt'
import { renderPng } from './pngExport'
import { COLOR_FIELD, PRINT } from './theme'
import type { ExportStyle } from './exportSvg'
import type { Play } from './types'

export const LETTER_W = 612
export const LETTER_H = 792

export function logoAsset(style: ExportStyle): string {
  return style === 'print' ? END_ZONE_LINE : END_ZONE_COLOR
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
  logoPng: Uint8Array
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
  const theme = input.style === 'print' ? PRINT : COLOR_FIELD
  const logo = await doc.embedPng(input.logoPng)
  const place = coverPlacement(input.art)
  const cover = doc.addPage([LETTER_W, LETTER_H])
  cover.drawRectangle({ x: 0, y: 0, width: LETTER_W, height: LETTER_H, color: fill(theme.page) })
  cover.drawImage(logo, { x: place.x, y: place.y, width: place.width, height: place.height })
  let titleSize = 36
  while (titleSize > 18 && bold.widthOfTextAtSize(title, titleSize) > 480) titleSize -= 2
  drawCentered(cover, title, place.titleY, titleSize, bold, fill(theme.title))
  drawCentered(cover, pdfSafe(input.dateLabel, ''), place.dateY, 16, font, fill(theme.muted))

  for (const bytes of input.pages) {
    const page = doc.addPage([LETTER_W, LETTER_H])
    const image = await doc.embedPng(bytes)
    page.drawImage(image, { x: 0, y: 0, width: LETTER_W, height: LETTER_H })
  }
  return doc.save()
}

async function rasterPng(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not load the team logo.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (url.endsWith('.png')) return bytes
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not read the team logo.'))
      image.src = objectUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable in this browser.')
    context.drawImage(image, 0, 0)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!png) throw new Error('Could not prepare the team logo.')
    return new Uint8Array(await png.arrayBuffer())
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** Letter playbook. The cover uses the color dog or the black line-art dog. */
export async function renderPlaybookPdf(input: {
  name: string
  plays: Play[]
  style: ExportStyle
  date: Date
  includeNotes: boolean
  includeAssignments: boolean
}): Promise<Uint8Array> {
  const logoPng = await rasterPng(logoAsset(input.style))
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
    logoPng,
    art: input.style === 'print' ? LINE_ART : COLOR_ART,
    pages,
  })
}
