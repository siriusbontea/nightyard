import { EXPORT_CAMERA, viewSize } from './geometry'
import { fieldMarkup } from './fieldMarkup'
import { categoryOf } from './categories'
import { assignmentRows, ballLabel } from './play'
import { COLOR_FIELD, PRINT, type Theme } from './theme'
import type { Play } from './types'
import { formatLabel } from './types'

export const EXPORT_W = 1275
export const EXPORT_H = 1650

export type ExportStyle = 'print' | 'color'

export interface ExportOptions {
  includeNotes?: boolean
  includeAssignments?: boolean
  fontCss?: string
}

export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (next.length > maxChars && line) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function themeFor(style: ExportStyle): Theme {
  return style === 'print' ? PRINT : COLOR_FIELD
}

export function renderExportSvg(play: Play, style: ExportStyle, options: ExportOptions = {}): string {
  const includeNotes = options.includeNotes !== false
  const includeAssignments = options.includeAssignments !== false
  const theme = themeFor(style)
  const camera = EXPORT_CAMERA
  const size = viewSize(camera)
  const margin = 72
  const notes = includeNotes && play.notes.trim() ? wrapText(play.notes.trim(), 78).slice(0, 4) : []
  const rows = includeAssignments ? assignmentRows(play).slice(0, 12) : []
  const textBlocks = (notes.length ? notes.length + 1 : 0) + (rows.length ? rows.length + 1 : 0)
  const textHeight = textBlocks * 28 + (textBlocks ? 18 : 0) + 36
  const titleLines = wrapText(play.name, 28).slice(0, 2)
  const header = 36 + titleLines.length * 48 + 34
  const slotTop = margin + header
  const slotH = Math.max(420, EXPORT_H - margin - textHeight - slotTop)
  const slotW = EXPORT_W - margin * 2
  const fit = Math.min(slotW / size.w, slotH / size.h)
  const fieldW = size.w * fit
  const fieldH = size.h * fit
  const fieldX = margin + (slotW - fieldW) / 2
  const fieldY = slotTop

  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${EXPORT_W}" height="${EXPORT_H}" viewBox="0 0 ${EXPORT_W} ${EXPORT_H}">`)
  if (options.fontCss) parts.push(`<defs><style><![CDATA[${options.fontCss}]]></style></defs>`)
  parts.push(`<rect width="${EXPORT_W}" height="${EXPORT_H}" fill="${theme.page}"/>`)
  let y = margin + 8
  for (const line of titleLines) {
    y += 44
    parts.push(
      `<text x="${margin}" y="${y}" fill="${theme.title}" font-family="Graduate, Impact, sans-serif" font-size="40" font-weight="400" letter-spacing="1">${escapeText(line)}</text>`,
    )
  }
  y += 28
  const subtitle = `${categoryOf(play)} · ${play.formation} · ${formatLabel(play.format)} · Ball on ${ballLabel(play.los)}`
  parts.push(
    `<text x="${margin}" y="${y}" fill="${theme.muted}" font-family="DM Sans, sans-serif" font-size="20">${escapeText(subtitle)}</text>`,
  )
  parts.push(`<g transform="translate(${fieldX.toFixed(1)} ${fieldY.toFixed(1)}) scale(${fit.toFixed(4)})">`)
  parts.push(fieldMarkup({ play, camera, theme, showHandles: false }))
  parts.push('</g>')

  let textY = fieldY + fieldH + 36
  if (notes.length) {
    parts.push(
      `<text x="${margin}" y="${textY}" fill="${theme.title}" font-family="Graduate, Impact, sans-serif" font-size="18" letter-spacing="1">NOTES</text>`,
    )
    textY += 26
    for (const line of notes) {
      parts.push(
        `<text x="${margin}" y="${textY}" fill="${theme.muted}" font-family="DM Sans, sans-serif" font-size="18">${escapeText(line)}</text>`,
      )
      textY += 26
    }
    textY += 10
  }
  if (rows.length) {
    parts.push(
      `<text x="${margin}" y="${textY}" fill="${theme.title}" font-family="Graduate, Impact, sans-serif" font-size="18" letter-spacing="1">ASSIGNMENTS</text>`,
    )
    textY += 28
    for (const row of rows) {
      parts.push(
        `<text x="${margin}" y="${textY}" fill="${theme.title}" font-family="DM Sans, sans-serif" font-size="18"><tspan font-weight="700">${escapeText(row.label)}</tspan><tspan fill="${theme.muted}">  ${escapeText(row.detail)}</tspan></text>`,
      )
      textY += 26
    }
  }
  parts.push(
    `<text x="${margin}" y="${EXPORT_H - 40}" fill="${theme.muted}" font-family="Graduate, Impact, sans-serif" font-size="16" letter-spacing="1">NIGHT YARD · SIRIUS BONTEA</text>`,
  )
  parts.push('</svg>')
  return parts.join('')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
